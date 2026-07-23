import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

import express from "express";
import type { Express } from "express";
import { MongoClient, ServerApiVersion, ObjectId } from "mongodb";

import OpenAI from 'openai';
import cors from "cors";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || 'agrimind_jwt_secret_key_2026';

// JWT Verification Middleware
const verifyJWT = (req: any, res: any, next: any) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized',
      message: 'Access token missing or malformed. Please provide a Bearer token in Authorization header.',
    });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded: any = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err: any) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized',
      message: 'Token has expired or is invalid. Please log in again.',
    });
  }
};


const app: Express = express();
const port: number = Number(process.env.PORT) || 8000;

app.use(cors());
app.use(express.json({
  verify: (req: any, res, buf) => {
    req.rawBody = buf;
  }
}));

// Issue JWT Token with User Role (Farmer, Buyer, Admin)
app.post('/jwt', (req, res) => {
  const { email = 'user@agrimind.ai', role = 'Farmer', userId } = req.body;
  const validRoles = ['Farmer', 'Buyer', 'Admin'];
  const userRole = validRoles.includes(role) ? role : 'Farmer';

  const token = jwt.sign(
    {
      email,
      role: userRole,
      userId: userId || 'usr_' + Math.random().toString(36).substring(2, 9),
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );

  return res.json({
    success: true,
    token,
    role: userRole,
    email,
    expiresIn: '7d',
  });
});

const uri = process.env.MONGODB_URI;

const client = new MongoClient(uri!, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    const database = client.db(process.env.MONGODB_DB);
    const userCollaction = database.collection('usercollaction');
    const users = database.collection('user');
    const productsCollaction = database.collection('products');
    const publicchatCollaction = database.collection('publicchat');
    const start = database.collection('start');
    const paymentsCollaction = database.collection('payments');

    

    app.get('/api/adminAcess/products',async(req,res)=>{
        const { page = 1, limit = 10 } = req.query;
        const skip = (Number(page) - 1) * Number(limit);
        const result = await productsCollaction.find().skip(skip).limit(Number(limit)).toArray();
        const totalData = await productsCollaction.countDocuments();
        const totalPage = Math.ceil(totalData / Number(limit));
        res.json({ data: result, page: Number(page), totalPage });
      })

    app.get('/api/payments/get-all-sales', async (req, res) => {
      try {
        const result = await paymentsCollaction.find().toArray();
        res.json(result);
      } catch (err: any) { res.status(500).json({ error: err.message }); }  
    });
    app.get('/api/buyer/payments/get-all-my-payments', async (req, res) => {
      try {
        const { page = 1, limit = 10 } = req.query;
        const skip = (Number(page) - 1) * Number(limit);
        const query: { buyerEmail?: string } = {};
          if (req.query.buyerEmail) {
          query.buyerEmail = req.query.buyerEmail as string;
        }
        const result = await paymentsCollaction.find(query).skip(skip).limit(Number(limit)).toArray();
        const totalData = await paymentsCollaction.countDocuments(query);
        const totalPage = Math.ceil(totalData / Number(limit));
        res.json({ data: result, page: Number(page), totalPage });
      } catch (err: any) { res.status(500).json({ error: err.message }); }  
    });
    app.get('/api/admin/payments/get-all-order', async (req, res) => {
      try {
        const { page = 1, limit = 10 } = req.query;
        const skip = (Number(page) - 1) * Number(limit);
        const result = await paymentsCollaction.find().skip(skip).limit(Number(limit)).toArray();
        const totalData = await paymentsCollaction.countDocuments();
        const totalPage = Math.ceil(totalData / Number(limit));
        res.json({ data: result, page: Number(page), totalPage });
      } catch (err: any) { res.status(500).json({ error: err.message }); }  
    });


    app.get('/api/farmer/products/pegination', async (req, res) => {
    try {
        const { page = 1, limit = 10 } = req.query;
        const skip = (Number(page) - 1) * Number(limit);
        const query: { farmerEmail?: string } = {};

        if (req.query.farmerEmail) {
          query.farmerEmail = req.query.farmerEmail as string;
        }

        const result = await productsCollaction.find(query).skip(skip).limit(Number(limit)).toArray();
        const totalData = await productsCollaction.countDocuments(query);
        const totalPage = Math.ceil(totalData / Number(limit));
        res.json({ data: result, page: Number(page), totalPage });
    } catch (err: any) { res.status(500).json({ error: err.message }); }  
    });






    app.post('/api/ai/generate-product', async (req, res) => {
      const { productName } = req.body;

      console.log('Received AI generation request for productName:', productName);

      if (!productName || typeof productName !== 'string' || productName.trim().length < 2) {
        return res.status(400).json({ error: 'A valid productName is required.' });
      }


      const buildFallback = (name: string) => {
        const n = name.toLowerCase();
        const isFruit = /(mango|banana|papaya|guava|jackfruit|watermelon|lychee|pineapple|orange|apple|grape|strawberry|pomegranate|melon|pear|plum|peach|fig|date|coconut|lemon|lime)/i.test(n);
        const isVeg = /(tomato|potato|onion|garlic|brinjal|eggplant|cabbage|cauliflower|spinach|cucumber|bitter gourd|bottle gourd|snake gourd|pumpkin|carrot|radish|bean|pea|okra|lady finger|chili|pepper|leek|turnip)/i.test(n);
        const isGrain = /(rice|wheat|maize|corn|barley|oat|lentil|dal|mustard|soybean|chickpea|jute|paddy)/i.test(n);
        const isHerb = /(ginger|turmeric|coriander|mint|basil|fenugreek|bay leaf|cumin|cardamom|clove|cinnamon|neem|aloe|moringa|curry leaf|thyme)/i.test(n);

        let category = 'Others';
        let pricePerKg = 60;

        if (isFruit) { category = 'Fruits'; pricePerKg = 80; }
        if (isVeg) { category = 'Vegetables'; pricePerKg = 45; }
        if (isGrain) { category = 'Grains'; pricePerKg = 55; }
        if (isHerb) { category = 'Herbs'; pricePerKg = 120; }

        const displayName = name.charAt(0).toUpperCase() + name.slice(1);
        const shortDescription =
          `Fresh ${displayName} sourced directly from Bangladeshi farms, ensuring maximum freshness and quality. ` +
          `Our ${displayName} is carefully harvested at peak ripeness to deliver the best taste and nutritional value to consumers. ` +
          `Rich in essential vitamins and minerals, it supports a healthy lifestyle and balanced diet. ` +
          `Order today for farm-to-table freshness delivered straight to your door across Bangladesh.`;

        return { shortDescription, pricePerKg, category };
      };


      try {
        if (!process.env.OPENAI_API_KEY) {
          console.warn('⚠️  OPENAI_API_KEY is missing — using smart fallback.');
          return res.json(buildFallback(productName.trim()));
        }

        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

        const chatCompletion = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          temperature: 0.4,
          max_tokens: 300,
          messages: [
            {
              role: 'system',
              content:
                'You are an expert agricultural product listing assistant for a Bangladeshi e-commerce marketplace. ' +
                'When given a product name, you MUST respond with ONLY a single raw JSON object — no markdown, no backticks, no explanation, no extra text. ' +
                'The JSON must have exactly three keys: ' +
                '"shortDescription" (string: 3-4 professional sentences about taste, nutrition, freshness, and Bangladeshi market context), ' +
                '"pricePerKg" (integer: realistic BDT market rate per kg based on typical Dhaka prices), ' +
                '"category" (string: MUST be exactly one of "Fruits", "Vegetables", "Grains", "Herbs", or "Others"). ' +
                'Output nothing except the JSON object.',
            },
            {
              role: 'user',
              content: `Product name: "${productName.trim()}"`,
            },
          ],
        });

        const rawText = chatCompletion.choices[0]?.message?.content ?? '';
        console.log('Raw OpenAI response:', rawText);


        let cleaned = rawText.trim();
        const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
        if (fenceMatch?.[1]) cleaned = fenceMatch[1];

        const startIdx = cleaned.indexOf('{');
        const endIdx = cleaned.lastIndexOf('}');
        if (startIdx !== -1 && endIdx > startIdx) {
          cleaned = cleaned.substring(startIdx, endIdx + 1);
        }

        console.log('Cleaned JSON string:', cleaned);
        const parsed = JSON.parse(cleaned);

        if (!parsed.shortDescription || typeof parsed.pricePerKg !== 'number' || !parsed.category) {
          console.warn('OpenAI response missing fields — using smart fallback.');
          return res.json(buildFallback(productName.trim()));
        }

        return res.json({
          shortDescription: String(parsed.shortDescription),
          pricePerKg: Math.round(Number(parsed.pricePerKg)),
          category: String(parsed.category),
        });

      } catch (error: any) {

        console.error('OpenAI API error — falling back to smart data:', error?.message ?? error);
        return res.json(buildFallback(productName.trim()));
      }
    });

    app.post('/api/ai/doctor-chat', async (req, res) => {
      const { role: bodyRole, message } = req.body as { role?: string; message: string };

      if (!message || typeof message !== 'string' || message.trim().length < 1) {
        return res.status(400).json({
          success: false,
          error: 'অনুগ্রহ করে আপনার প্রশ্ন বা বার্তাটি লিখুন।',
        });
      }

      // JWT Authorization Header Verification
      let activeRole = bodyRole || 'Farmer';
      let userEmail = 'guest@agrimind.ai';
      const authHeader = req.headers.authorization;

      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        try {
          const decoded: any = jwt.verify(token, JWT_SECRET);
          activeRole = decoded.role || activeRole;
          userEmail = decoded.email || userEmail;
        } catch (err: any) {
          return res.status(401).json({
            success: false,
            error: 'Unauthorized',
            message: 'Your JWT token has expired or is invalid. Please log in again to refresh your token.',
          });
        }
      }

      const cleanMessage = message.trim();
      const m = cleanMessage.toLowerCase();

      // Role-Based Access Control (RBAC) Restrictions:
      // 1. Admin-Only Topics (Platform analytics, farmer/buyer stats, low stock alerts)
      const isAdminTopic = /(active farmer|active buyer|কতজন|নিবন্ধিত কৃষক|অ্যাক্টিভ বায়ার|অ্যাক্টিভ বায়ার|stats|স্ট্যাটস|inventory|ইনভেন্টরি|low stock|ঘাটতি|প্রস্তুত আছে)/.test(m);

      if (isAdminTopic && activeRole !== 'Admin') {
        return res.status(403).json({
          success: false,
          error: 'Forbidden',
          message: `Forbidden: Platform analytics and stock alert Q&As require 'Admin' role. Your current role is '${activeRole}'.`,
        });
      }

      // 2. Buyer/Admin Topics (Bulk pricing, supply contracts, packaging, refunds, invoices)
      const isBuyerTopic = /(organic|chemical free|বিষমুক্ত|grading|sample|স্যাম্পল|bulk order|discount|পাইকারি|ডিসকাউন্ট|credit|bKash|nagad|invoice|ইনভয়েস|supply|সাপ্লাই|packaging|প্যাকেজিং|refund|রিফান্ড|ক্ষতিপূরণ|কোল্ড চেইন|buyer|বায়ার|সুপারশপ)/.test(m);

      if (isBuyerTopic && activeRole !== 'Buyer' && activeRole !== 'Admin') {
        return res.status(403).json({
          success: false,
          error: 'Forbidden',
          message: `Forbidden: Bulk pricing, supply contracts, and quality standards Q&As require 'Buyer' or 'Admin' role. Your current role is '${activeRole}'.`,
        });
      }

      const buildSmartFallback = (msg: string): string => {
        const m = msg.toLowerCase();

        // Short Acknowledgment / Affirmation (আচ্ছা / ধন্যবাদ / ok / acha)
        if (/^(acah|acha|achha|okay|ok|জি|আচ্ছা|ধন্যবাদ|thanks|thank you)$/i.test(m.trim())) {
          return [
            'আপনাকে অসংখ্য ধন্যবাদ! 😊',
            '',
            'কৃষি, ফসল, সার, সেচ বা চাষাবাদ সংক্রান্ত যেকোনো প্রশ্নে আমি সাহায্য করতে প্রস্তুত।',
            '',
            'আপনার আর কী পরামর্শ লাগবে বলুন। 🌱'
          ].join('\n');
        }

        // Greeting detection
        if (/(kamon|kemon|kemne|khobor|hello|hi|keamon|ভালো|কেমন|আসসালামু)/.test(m)) {
          return [
            'ওয়ালাইকুম আসসালাম! আলহামদুলিল্লাহ, আমি ভালো আছি। 😊',
            '',
            'কৃষি, ফসল, সার, মাটির যত্ন বা রোগবালাই সংক্রান্ত যেকোনো বিষয়ে আপনাকে সাহায্য করতে প্রস্তুত। আপনার কী পরামর্শ লাগবে বলুন?',
            '',
            'আপনার আর কী পরামর্শ লাগবে বলুন। 🌱'
          ].join('\n');
        }

        // AgriMind AI Identity & Purpose (AgriMind কী / কিভাবে সাহায্য করে / আপনি কে)
        if (/(agrimind|agri mind|এগ্রিমাইন্ড|এগ্রি মাইন্ড|tumi ke|ke tumi|tumi kare|কী এবং|কি এবং|সাহায্য করে|কীভাবে সাহায্য)/.test(m)) {
          return [
            '## AgriMind AI কী এবং এটি কৃষকদের কীভাবে সাহায্য করে?',
            '',
            '**AgriMind AI** একটি আধুনিক স্মার্ট এগ্রিকালচার প্ল্যাটফর্ম ও কৃত্রিম বুদ্ধিমত্তা সম্পন্ন সহকারী, যা বাংলাদেশের কৃষকদের এবং কৃষি উদ্যোক্তাদের আধুনিক চাষাবাদে সার্বিক সহায়তা প্রদান করে।',
            '',
            '### 🌾 এটি কৃষকদের যেভাবে সাহায্য করে:',
            '১. **ফসলের রোগ সনাক্তকরণ ও চিকিৎসা:** ফসলের রোগবালাইয়ের লক্ষণ বিশ্লেষণ করে কার্যকর জৈব ও রাসায়নিক প্রতিকার প্রদান করে।',
            '২. **মাটি ও সার ব্যবস্থাপনা:** মাটির ধরন অনুযায়ী সুষম সার এবং জৈব কম্পোস্ট প্রয়োগের পরিমাপ বলে দেয়।',
            '৩. **আবহাওয়া পর্যবেক্ষণ ও ঝুঁকি সতর্কতা:** অতিবৃষ্টি, খরা বা ঝড়ের পূর্বাভাসের ওপর ভিত্তি করে ফসল রক্ষার পূর্বাভাস ও পরামর্শ প্রদান করে।',
            '৪. **মরশুম ভিত্তিক ফসল নির্বাচন:** সঠিক সময়ে কোন বীজ রোপণ করলে বাম্পার ফলন পাওয়া যাবে তা নির্দেশ করে।',
            '৫. **উৎপাদন খরচ হ্রাস ও বাজার গাইড:** কম খরচে অধিক ফসল ফলানোর উপায় এবং লাভজনক উপায়ে ফসল বিক্রির বাজার তথ্য প্রদান করে।',
            '',
            'আপনার আর কী পরামর্শ লাগবে বলুন। 🌱'
          ].join('\n');
        }

        // Seasonal Crop & Month Advice (মরশুম / মাস / সিজন / ফসলের সিজন / আষাঢ় / শ্রাবণ)
        if (/(mosom|mowsom|mowsoma|season|session|sison|sijon|সিজন|মরশুম|মাস|mas|foshol|ফসল|kon biz|কোন বীজ|giude|গাইড)/.test(m)) {
          return [
            '## বাংলাদেশে বর্তমান মরশুম (জুলাই - আষাঢ়/শ্রাবণ) ও চাষাবাদ নির্দেশিকা:',
            '',
            '### 📅 বর্তমান সময় ও মরশুম:',
            '- **মরশুম:** খরিফ-২ (বর্ষাকালীন ফসল মরশুম)।',
            '- **মাস:** জুলাই-আগস্ট (বাংলা আষাঢ় ও শ্রাবণ মাস)।',
            '',
            '### 🌾 এই মরশুমের সেরা ফসল ও বীজ:',
            '১. **রোপা আমন ধান:** ব্রি ধান৪৯, ব্রি ধান৮৭, ব্রি ধান৭৫ বা ব্রি ধান৯৫ (বিএডিসি অনুমোদিত বীজ)।',
            '২. **বর্ষাকালীন শাকসবজি:** লাল শাক, পুঁই শাক, ডাটা শাক, ঝিঙে, পটোল, চিচিঙ্গা, ও বেগুন।',
            '',
            '### 📋 অনুসরণযোগ্য সেরা পরামর্শ:',
            '- নিচু জমিতে জমা অতিরিক্ত পানি নিষ্কাশনের পথ খোলা রাখুন।',
            '- রোপা আমনের ক্ষেত্রে ২০-২৫ দিনের সতেজ চারা সারিবদ্ধভাবে রোপণ করুন।',
            '- বীজ ক্রয়ের সময় বিএডিসি (BADC) বা বারি (BARI) সার্টিফাইড বীজ প্যাকেট দেখে কিনুন।',
            '',
            'আপনার আর কী পরামর্শ লাগবে বলুন। 🌱'
          ].join('\n');
        }

        // Soil-to-Crop Advice (কোন মাটিতে কি ফলন ভালো হয়)
        if (/(kon mati|kon matita|mati ta|মাটিতে|মাটি|দোআঁশ|বেলে|এঁটেল)/.test(m)) {
          return [
            '## বিভিন্ন প্রকার মাটিতে কোন ফসল ভালো হয়:',
            '',
            '### ১. দোআঁশ মাটি (সবচেয়ে উর্বর মাটি):',
            '- **সেরা ফসল:** ধান, গম, আলু, টমেটো, বেগুন, মরিচ, মসুর ডাল ও সব ধরনের শাকসবজি।',
            '',
            '### ২. এঁটেল মাটি (পানি ধারণক্ষমতা বেশি):',
            '- **সেরা ফসল:** রোপা আমন ধান, পাট, আখ, কাঁঠাল ও ডাল জাতীয় ফসল।',
            '',
            '### ৩. বেলে-দোআঁশ ও বেলে মাটি:',
            '- **সেরা ফসল:** বাদাম, তরমুজ, ফুটি, গাজর, মুলো, মিষ্টি আলু, পেঁয়াজ ও রসুন।',
            '',
            '### ৪. পাহাড়ী অম্লীয় মাটি (pH ৪.৫ - ৫.৫):',
            '- **সেরা ফসল:** চা, আনারস, কমলা ও লেবু জাতীয় ফল।',
            '',
            'আপনার আর কী পরামর্শ লাগবে বলুন। 🌱'
          ].join('\n');
        }

        // Seed selection & seedling death (বীজ নির্বাচন ও চারা মারা যাওয়া/ঢলে পড়া)
        if (/(biz chenar|biz|বীজ চেনার|খারাপ বীজ|chara mara|চারা মারা|ঢলে পড়া|damping off)/.test(m)) {
          return [
            '## বীজ নির্বাচন ও চারা রক্ষা নির্দেশিকা:',
            '',
            '### ১. ভালো মানের বীজ চেনার উপায়:',
            '- ভালো বীজ ঝরঝরে, দাগহীন, পরিপুষ্ট ও কঙ্করমুক্ত হয়।',
            '- পানিতে ভিজালে যেগুলো ভেসে ওঠে সেগুলো বাদ দিন। কঙ্করহীন বীজ ব্যবহার করলে অঙ্কুরোদ্গম ভালো হয়।',
            '',
            '### ২. চারা রোপণের পর মারা যাওয়া (Damping Off) রোধ:',
            '- **কারণ:** শেকড় ক্ষতিগ্রস্ত হওয়া, অতিরিক্ত পানি জমে থাকা, মাটির তাপমাত্রা বেশি থাকা বা ছত্রাকের আক্রমণ।',
            '- **সমাধান:** ট্রাইকোডার্মা বা ব্যাভিস্টিন দিয়ে বীজ শোধন করে রোপণ করুন এবং চারা তলায় পানি জমতে দেবেন না।',
            '',
            'আপনার আর কী পরামর্শ লাগবে বলুন। 🌱'
          ].join('\n');
        }

        // Rice Stem Borer & White Head (মাঝরা পোকা ও ধানের চিটা/শিষ সাদা)
        if (/(majra|মাঝরা|চিটা|chita|শিষ সাদা|shish shada|stem borer)/.test(m)) {
          return [
            '## ধানের মাঝরা পোকা ও শিষ সাদা (চিটা) দমনের উপায়:',
            '',
            '### ১. লক্ষণ:',
            '- এটি কান্ড ছিদ্রকারী মাঝরা পোকার আক্রমণ। আক্রান্ত গাছের মাঝখানের পাতা/শিষ টেনে তুললে সহজে উঠে আসে।',
            '',
            '### ২. প্রতিকার ও বালাই ব্যবস্থাপনা:',
            '- **পার্চিং (Perching):** জমিতে প্রতি শতকে ১-২টি কঞ্চির ডাল পুঁতে দিন যাতে পাখি বসে পোকা খেতে পারে।',
            '- **রাসায়নিক সমাধান:** তীব্র আক্রমণে কার্টাপ (যেমন: সানটাপ) বা ফিপ্রোনিল (যেমন: রিজেন্ট) গ্রুপের কীটনাশক সঠিক মাত্রায় স্প্রে করুন।',
            '',
            'আপনার আর কী পরামর্শ লাগবে বলুন। 🌱'
          ].join('\n');
        }

        // Eggplant/Tomato Shoot & Fruit Borer (ডগা ও ফল ছিদ্রকারী পোকা)
        if (/(doga|ডগা|ছিদ্র|chidro|fruit borer|shoot borer)/.test(m)) {
          return [
            '## বেগুন ও টমেটোর ডগা ও ফল ছিদ্রকারী পোকা দমনের সমাধান:',
            '',
            '### ১. প্রাথমিক করণীয়:',
            '- আক্রান্ত ডগা ও ফল কেটে দূরে নিয়ে মাটিতে পুঁতে ফেলুন।',
            '',
            '### ২. জৈব ও রাসায়নিক পদ্ধতি:',
            '- **ফেরোমন ফাঁদ:** ক্ষেতে সেক্স ফেরোমোন ট্র্যাপ (ফাঁদ) স্থাপন করুন।',
            '- **স্প্রে:** বায়ো-কীটনাশক (যেমন: ট্রেসার/স্পিনোসেড) অথবা এমামেকটিন বেঞ্জোয়েট গ্রুপের কীটনাশক বিকেলে স্প্রে করুন।',
            '',
            'আপনার আর কী পরামর্শ লাগবে বলুন। 🌱'
          ].join('\n');
        }

        // Powdery Mildew (পাতায় সাদা পাউডার রোগ)
        if (/(powder|পাউডার|পাউডারি|powdery|সাদা আস্তরণ|shada astoron)/.test(m)) {
          return [
            '## পাতায় সাদা পাউডারি মিলডিউ রোগ দূর করার উপায়:',
            '',
            '### ১. কারণ ও লক্ষণ:',
            '- এটি একপ্রকার ছত্রাকজনিত রোগ। এতে পাতার ওপর সাদা পাউডারের মতো আস্তরণ পড়ে।',
            '',
            '### ২. প্রতিকার:',
            '- আক্রান্ত পাতা বা গাছের অংশ ছাঁটাই করে ধ্বংস করুন।',
            '- সালফার জাতীয় ছত্রাকনাশক (যেমন: থিওভিট বা কুমুলাস) প্রতি লিটার পানিতে ২ গ্রাম হারে মিশিয়ে বিকেলে স্প্রে করুন।',
            '',
            'আপনার আর কী পরামর্শ লাগবে বলুন। 🌱'
          ].join('\n');
        }

        // Flower & Fruit Drop / Boron Deficiency (ফুল-ফল ঝরে যাওয়া ও বোরণ)
        if (/(ful jhore|fol jhore|ফুল ঝরে|ফল ঝরে|ফুল আসছে না|boron|বোরণ|নাইট্রোজেন)/.test(m)) {
          return [
            '## গাছে ফুল-ফল ঝরে পড়া ও নতুন ফুল না আসার কারণ ও প্রতিকার:',
            '',
            '### ১. মূল কারণসমূহ:',
            '- অতিরিক্ত নাইট্রোজেন (ইউরিয়া) দিলে শুধু পাতা বড় হয়, ফুল-ফল কমে যায়।',
            '- মাটি বা গাছে পটাশ ও বোরণ (Boron) সারের অভাব থাকলেও ফুল-ফল ঝরে পড়ে।',
            '',
            '### ২. সমাধানের উপায়:',
            '- ইউরিয়া সার সীমিত রেখে সুষম পটাশ (MOP) ব্যবহার করুন।',
            '- ফুল আসার পূর্বে ও পর সোলুবোর বোরণ (Solubor Boron) ১.৫ গ্রাম প্রতি লিটার পানিতে মিশিয়ে গাছে স্প্রে করুন।',
            '',
            'আপনার আর কী পরামর্শ লাগবে বলুন। 🌱'
          ].join('\n');
        }

        // Hard Soil & Organic Matter (মাটি শক্ত হওয়া ও ট্রাইকো-কম্পোস্ট)
        if (/(sokto mati|মাটি শক্ত|pani shukacche na|পানি শুকাচ্ছে না|tricho|ট্রাইকো|ধৈঞ্চা|সবুজ সার)/.test(m)) {
          return [
            '## মাটি শক্ত হয়ে যাওয়া ও পানি না শুকানোর সমাধান:',
            '',
            '### ১. কারণ:',
            '- মাটিতে জৈব পদার্থের (গোবর/কম্পোস্ট) পরিমাণ কমে গেলে মাটি শক্ত ও নিসাড় হয়ে যায়।',
            '',
            '### ২. উর্বরতা ফেরানোর উপায়:',
            '- জমিতে **ট্রাইকো-কম্পোস্ট** বা পচা গোবর প্রয়োগ করুন।',
            '- ফসল কাটার পর **ধৈঞ্চা (সবুজ সার)** চাষ করে কচি অবস্থায় মাটিতে মিশিয়ে চাষ দিন। এতে মাটির পানি ধারণ ও নিষ্কাশন ক্ষমতা বাড়ে।',
            '',
            'আপনার আর কী পরামর্শ লাগবে বলুন। 🌱'
          ].join('\n');
        }

        // Soil Salinity (জমিতে নোনা / লবণাক্ততা)
        if (/(nona|নোনা|লবণাক্ত|salinity|saline)/.test(m)) {
          return [
            '## জমিতে লবণাক্ততা (নোনা) ধরা প্রতিরোধ ও প্রতিকার:',
            '',
            '### ১. মাটির নোনা ধুয়ে ফেলা:',
            '- জমিতে ভালো ও মিষ্টি পানির সেচ দিয়ে নোনা পানি ড্রেন (Drainage) দিয়ে বের করে দিন।',
            '',
            '### ২. জিপসাম ও লবণসহনশীল জাত:',
            '- প্রতি শতকে জিপসাম সার প্রয়োগ করুন, যা মাটির ক্ষতিকারক সোডিয়াম দূর করে।',
            '- লবণসহনশীল জাতের ফসল (যেমন: ব্রি ধান৫৩, ব্রি ধান৫৮ বা লবণসহনশীল সূর্যমুখী/সরিষা) চাষ করুন।',
            '',
            'আপনার আর কী পরামর্শ লাগবে বলুন। 🌱'
          ].join('\n');
        }

        // Grain Storage & Post-Harvest Insects (ফসল সংরক্ষণ ও পোকা ধরা)
        if (/(sangrokkhon|সংরক্ষণ|poka dhora|পোকা ধরা|kacha|কাঁচা|nim pata|নিম পাতা|gudam|গুদাম)/.test(m)) {
          return [
            '## ফসল কাটার পর সঠিক সংরক্ষণ ও পোকা প্রতিরোধ:',
            '',
            '### ১. কারণ:',
            '- শস্যে আর্দ্রতা ১২%-এর বেশি থাকলে বা বীজ কাঁচা অবস্থায় গুদামজাত করলে পোকা ও ফাঙ্গাস ধরে।',
            '',
            '### ২. সংরক্ষণ নিয়মাবলী:',
            '- রৌদে ভালোভাবে ৩-৪ দিন শুকিয়ে নিন (বীজ দাঁতে কামড় দিলে কট করে শব্দ হতে হবে)।',
            '- বস্তা বা পাত্রে শুকনো **নিম পাতা** বা নিমের গুঁড়ো মিশিয়ে রাখলে প্রাকৃতিকভাবে পোকা ধরে না।',
            '',
            'আপনার আর কী পরামর্শ লাগবে বলুন। 🌱'
          ].join('\n');
        }

        // High Crop Yield Advice (ভালো ফলন / কী কী মানলে)
        if (/(folon|ফলন|মানলে|উপায়|উপায়|নিয়ম|নিয়ম|পদ্ধতি)/.test(m)) {
          return [
            '## বাম্পার ও ভালো ফলন নিশ্চিত করার ৭টি সোনালী নিয়ম:',
            '',
            '### ১. উন্নত জাতের শোধিত বীজ:',
            '- সরকার অনুমোদিত ও ভালো মানের শোধিত বীজ ব্যবহার করুন।',
            '',
            '### ২. মাটি পরীক্ষা ও জৈব সার প্রয়োগ:',
            '- জমি চাষের সময় পর্যাপ্ত গোবর, কম্পোস্ট বা জৈব সার মিশিয়ে মাটির উর্বরতা বাড়ান।',
            '',
            '### ৩. সুষম সার ব্যবস্থাপনা:',
            '- নাইট্রোজেন, ফসফরাস ও পটাশিয়াম (NPK) সঠিক অনুপাতে এবং সঠিক সময়ে প্রয়োগ করুন।',
            '',
            '### ৪. সঠিক সময়ে সেচ ও আগাছা দমন:',
            '- জমিতে অতিরিক্ত পানি জমতে না দিয়ে প্রয়োজন অনুযায়ী পরিমিত সেচ দিন এবং নিয়মিত আগাছা পরিষ্কার রাখুন।',
            '',
            '### ৫. সমন্বিত বালাই ব্যবস্থাপনা (IPM):',
            '- পোকা দমনে ক্ষতিকর রাসায়নিক পরিহার করে হলুদ ফাঁদ ও জৈব বালাইনাশক ব্যবহার করুন।',
            '',
            'আপনার আর কী পরামর্শ লাগবে বলুন। 🌱'
          ].join('\n');
        }

        // Buyer: Quality, Organic & Sample (অর্গানিক, গ্রেডিং ও স্যাম্পল)
        if (/(organic|chemical free|বিষমুক্ত|grading|grade|sample|স্যাম্পল|নমুনা|গুণগত)/.test(m)) {
          return [
            '## Agrimind বায়ার নির্দেশিকা - পণ্যের মান, অর্গানিক ও স্যাম্পলিং:',
            '',
            '### ১. অর্গানিক ও বিষমুক্ত ফসল:',
            '- Agrimind-এর নিবন্ধিত কৃষকরা আইপিএম (IPM) ও জৈব পদ্ধতিতে চাষ করেন। প্রতিটি পণ্যে অর্গানিক বা সাধারণ উল্লেখ থাকে।',
            '',
            '### ২. কোয়ালিটি গ্রেডিং (Grade A, B, C):',
            '- সাইজ, রঙ ও সতেজতার ভিত্তিতে পণ্যকে Grade A, B, ও C-তে বিন্যস্ত করা হয়।',
            '',
            '### ৩. স্যাম্পল ও লাইভ আপডেট:',
            '- অর্ডারের পূর্বে চ্যাটবট/প্ল্যাটফর্মে মাঠের সাম্প্রতিক ছবি/ভিডিও দেখতে পারবেন। বড় অর্ডারে স্যাম্পল পাঠানোর সুবিধা রয়েছে।',
            '',
            'আপনার আর কী পরামর্শ লাগবে বলুন। 🌱'
          ].join('\n');
        }

        // Buyer: Bulk Pricing, Payment & Credit (পাইকারি মূল্য, ডিসকাউন্ট ও পেমেন্ট)
        if (/(bulk order|bulk|discount|পাইকারি|ডিসকাউন্ট|payment|পেমেন্ট|credit|ক্যাশ অন|bKash|nagad|bank|invoice|ইনভয়েস)/.test(m)) {
          return [
            '## Agrimind বায়ার নির্দেশিকা - পাইকারি মূল্য, ডিসকাউন্ট ও পেমেন্ট:',
            '',
            '### ১. পাইকারি ডিসকাউন্ট (Bulk Discount):',
            '- অর্ডারের পরিমাণের ওপর ভিত্তি করে আকর্ষণীয় পাইকারি মূল্য নির্ধারণ করা হয়। বেশি পরিমাণে ভালো ছাড় মিলবে।',
            '',
            '### ২. বাজার দর ও স্বচ্ছতা:',
            '- মধ্যস্বত্বভোগী ছাড়া সরাসরি মাঠের দাম ও বাজার দর বিশ্লেষণ করে ন্যায্য মূল্য ঠিক করা হয়।',
            '',
            '### ৩. পেমেন্ট মেথড ও ক্রেডিট:',
            '- বিকাশ, নগদ, ব্যাংক ট্র্যান্সফার বা ক্যাশ অন ডেলিভারি (COD) প্রযোজ্য। নিয়মিত বায়ারদের পারশিয়াল/ক্রেডিট সুবিধা ও ডিজিটাল মেমো/ইনভয়েস দেওয়া হয়।',
            '',
            'আপনার আর কী পরামর্শ লাগবে বলুন। 🌱'
          ].join('\n');
        }

        // Buyer: Supply, Logistics & Refund (সাপ্লাই চুক্তি, ডেলিভারি ও রিফান্ড)
        if (/(supply|সাপ্লাই|delivery|ডেলিভারি|packaging|প্যাকেজিং|refund|রিফান্ড|ক্ষতিপূরণ|পরিবহন|কোল্ড চেইন)/.test(m)) {
          return [
            '## Agrimind বায়ার নির্দেশিকা - সরবরাহ, ডেলিভারি ও প্যাকেজিং:',
            '',
            '### ১. নিয়মিত সাপ্লাই কন্টাক্ট:',
            '- পাইকারি ক্রেতা বা সুপারশপের সাথে চুক্তি করে নিয়মিত নির্দিষ্ট পরিমাণ ফসল সরবরাহের সুব্যবস্থা রয়েছে।',
            '',
            '### ২. ডেলিভারি ও কোল্ড চেইন প্যাকেজিং:',
            '- জেলা শহরে ২৪-৪৮ ঘণ্টা এবং দূরপাল্লায় ২-৩ দিনের মধ্যে ছিদ্রযুক্ত ক্যাট/ক্রেইট বা কোল্ড ভ্যানে পৌঁছানো হয়।',
            '',
            '### ৩. ক্ষতিপূরণ ও রিফান্ড পলিসি:',
            '- পরিবহনে ফসল নষ্ট হলে আনবক্সিং ভিডিও/ছবি প্রদান করে তাৎক্ষণিক রিফান্ড বা রিপ্লেসমেন্ট ক্লেম করা যায়।',
            '',
            'আপনার আর কী পরামর্শ লাগবে বলুন। 🌱'
          ].join('\n');
        }

        // General Buyer / B2B Trade Overview (বায়ার ও কর্পোরেট কেনাকাটা)
        if (/(buyer|বায়ার|ক্রেতা|সুপারশপ|পাইকারি বিক্রেতা|খরিদ্দার)/.test(m)) {
          return [
            '## Agrimind B2B বায়ার ও পাইকারি সোর্সিং প্ল্যাটফর্ম:',
            '',
            'Agrimind সরাসরি কৃষক ও বায়ারদের (পাইকারি ব্যবসায়ী, সুপারশপ ও সাধারণ ক্রেতা) যুক্ত করে:',
            '',
            '১. **মানের নিশ্চয়তা:** Grade A/B/C ক্যাটাগরি ও অর্গানিক ট্যাগিং।',
            '২. **পাইকারি মূল্য:** দালালমুক্ত সরাসরি মাঠের দাম ও বাল্ক ডিসকাউন্ট।',
            '৩. **নিরাপদ লজিস্টিকস:** কোল্ড চেইন প্যাকেজিং ও ২৪-৪৮ ঘণ্টায় ডেলিভারি।',
            '৪. **আইনি নিরাপত্তা:** প্রফেশনাল মেমো, ডিজিটাল ইনভয়েস ও জমি পরিদর্শনের সুবিধা।',
            '',
            'আপনার আর কী পরামর্শ লাগবে বলুন। 🌱'
          ].join('\n');
        }

        // Platform Stats: Active Farmers & Buyers (সক্রিয় কৃষক ও বায়ার সংখ্যা)
        if (/(active farmer|active buyer|কতজন|নিবন্ধিত কৃষক|অ্যাক্টিভ বায়ার|অ্যাক্টিভ বায়ার|stats|স্ট্যাটস)/.test(m)) {
          return [
            '## Agrimind প্ল্যাটফর্ম স্ট্যাটাস ও লাইভ পরিসংখ্যান:',
            '',
            '### 📊 নিবন্ধিত ব্যবহারকারী:',
            '- **সক্রিয় কৃষক (Active Farmers):** ৩,৫০০ জন নিবন্ধিত ও সক্রিয় কৃষক।',
            '- **অ্যাক্টিভ বায়ার (Active Buyers):** ৮৫০ জন সক্রিয় পাইকারি ও খুচরা বায়ার।',
            '- **আজকের নতুন রেজিস্ট্রেশন:** ২৫ জন নতুন কৃষক যুক্ত হয়েছেন।',
            '',
            'আপনার আর কী পরামর্শ লাগবে বলুন। 🌱'
          ].join('\n');
        }

        // Inventory & Top Selling Crops (চাহিদাপূর্ণ ফসল ও ইনভেন্টরি স্টক)
        if (/(top selling|সবচেয়ে বেশি চাহিদা|চাহিদা বেশি|chahida|stock|স্টক|inventory|ইনভেন্টরি|low stock|ঘাটতি|প্রস্তুত আছে|প্রস্তুত)/.test(m)) {
          return [
            '## Agrimind ইনভেন্টরি ও ফসল সরবরাহ লাইভ আপডেট:',
            '',
            '### 🔥 সর্বোচ্চ চাহিদাসম্পন্ন ফসল (Top Selling Crops):',
            '- **আলু:** ১৫ টন (সর্বোচ্চ চাহিদা)',
            '- **টমেটো:** ৮ টন',
            '',
            '### ⚠️ স্টক সংকেত (Low Stock Alert):',
            '- **দেশি পেঁয়াজ ও বেগুন:** স্টক কমে এসেছে। আগামী ৩ দিনের মধ্যে অতিরিক্ত ৫ টন পেঁয়াজের সরবরাহ প্রয়োজন।',
            '',
            '### 🚚 বিক্রির জন্য প্রস্তুত রেডি স্টক (Ready Stock):',
            '- **রংপুর জোন:** ৫০০ মন আলু প্রস্তুত।',
            '- **বগুড়া জোন:** ২০০ মন টমেটো প্রস্তুত।',
            '',
            'আপনার আর কী পরামর্শ লাগবে বলুন। 🌱'
          ].join('\n');
        }

        // Rice / Paddy Cultivation (ধান চাষ)
        if (/(ধান|dan|dhan|paddy|rice|কাদ|রোপণ|বীজ)/.test(m)) {
          return [
            '## ধান চাষের প্রয়োজনীয় নির্দেশনা:',
            '',
            '### ১. জাত নির্বাচন ও বীজ শোধন:',
            '- আপনার এলাকার উপযোগী উচ্চফলনশীল জাত (যেমন: ব্রি ধান২৮, ব্রি ধান২৯, ব্রি ধান৮৯ বা ব্রি ধান৯২) নির্বাচন করুন।',
            '- প্রতি কেজি বীজে ২ গ্রাম ব্যাভিস্টিন মিশিয়ে বীজ শোধন করে নিন।',
            '',
            '### ২. জমি প্রস্তুত ও চারা রোপণ:',
            '- ৩-৪ টি চাষ ও মই দিয়ে জমি ভালোভাবে কাদা করুন।',
            '- সুস্থ ও সতেজ ২০-২৫ দিন বয়সের চারা লাইনে রোপণ করুন (লাইন থেকে লাইন ২০ সেমি, চারা থেকে চারা ১৫ সেমি)।',
            '',
            '### ৩. সার ব্যবস্থাপনা (প্রতি শতকে আনুমানিক):',
            '- জৈব সার/গোবর: ২০-২৫ কেজি (জমি তৈরির সময়)',
            '- ইউরিয়া: ৮০০ গ্রাম (৩ কিস্তিতে প্রয়োগ যোগ্য)',
            '- টিএসপি: ৪০০ গ্রাম (জমি তৈরির শেষ চাষে)',
            '- এমওপি: ৪৫০ গ্রাম',
            '',
            '### ৪. পানি ও পরিচর্যা:',
            '- চারা রোপণের পর ২-৩ ইঞ্চি পানি ধরে রাখুন। কাইনোর মাধ্যমে নিয়মিত আগাছা পরিষ্কার করুন।',
            '',
            'আপনার আর কী পরামর্শ লাগবে বলুন। 🌱'
          ].join('\n');
        }

        // Tomato / Vegetables (টমেটো / সবজি)
        if (/(টমেটো|tomato|সবজি|সবজী|বেগুন|মরিচ|শাক)/.test(m)) {
          return [
            '## সবজি ও টমেটো চাষের পরামর্শ:',
            '',
            '### ১. জমি ও মাটি:',
            '- পানি নিষ্কাশনের ভালো সুবিধাযুক্ত দোআঁশ বা বেলে-দোআঁশ মাটি সবজি চাষের জন্য সেরা।',
            '',
            '### ২. রোগবালাই ও পোকা দমন:',
            '- পাতা হলুদ হওয়া বা রোগ রোধে অতিরিক্ত পানি নিষ্কাশনের ব্যবস্থা রাখুন।',
            '- সাদা মাছি বা শোষক পোকার আক্রমণে নিমের খৈল বা জৈব বালাইনাশক স্প্রে করুন।',
            '',
            'আপনার আর কী পরামর্শ লাগবে বলুন। 🌱'
          ].join('\n');
        }

        // Pest control (পোকা / রোগ)
        if (/(পোকা|poka|রোগ|rog|কীট|ছত্রাক|পচন|দাগ)/.test(m)) {
          return [
            '## রোগ ও পোকা দমনের প্রাথমিক দিকনির্দেশনা:',
            '',
            '### করণীয়:',
            '১. আক্রান্ত গাছের পাতা বা অংশ কেটে দূরে ফেলে দিন বা পুড়িয়ে ফেলুন।',
            '২. জৈব উপায়ে পোকা দমনে হলুদ ফাঁদ বা ফেরোমন ফাঁদ ব্যবহার করতে পারেন।',
            '৩. ছত্রাকজনিত রোগ হলে ইমিডাক্লোপ্রিড বা প্রপিকোনাজল গ্রুপের ভালো ছত্রাকনাশক সঠিক মাত্রায় বিকেলে স্প্রে করুন।',
            '',
            'আপনার আর কী পরামর্শ লাগবে বলুন। 🌱'
          ].join('\n');
        }

        // Buying Fruits & Vegetables / Market Advice (কেনাকাটা, বাজার, ফল ও শাকসবজি)
        if (/(kinta|bazar|bazer|bajar|কেনাকাটা|কিনতে|বাজার|ফোল|কেনার)/.test(m)) {
          return [
            '## তাজা ফল ও শাকসবজি কেনাকাটার পরামর্শ ও বর্তমান বাজার গাইড:',
            '',
            '### ১. বর্তমান মরশুমের ভালো ফল:',
            '- **তাজা ফল:** পেয়ারা, দেশি পাকা পেঁপে, কলা, ও আম্রপালি আম। ফল কেনার সময় হালকা ঘ্রাণ ও নিরেট ছাল দেখে নিন।',
            '',
            '### ২. সতেজ শাকসবজি নির্বাচন:',
            '- **শাক:** লাল শাক, পালং শাক ও ডাটা শাক — কচি ও সতেজ উজ্জ্বল পাতা দেখে কিনুন।',
            '- **সবজি:** পটল, ঢ্যাঁড়শ, কচি বেগুন ও শসা — ছোট ও তাজা সবজিতে বীজ কম থাকে এবং স্বাদ ভালো হয়।',
            '',
            '### ৩. বাজার করার টিপস:',
            '- সকালে বা কৃষক ডাইরেক্ট মার্কেট থেকে কেনাকাটা করলে কেমিক্যালমুক্ত খাবার পাওয়া যায়।',
            '- কেনাকাটার পর ১০-১৫ মিনিট পানিতে ভিজিয়ে ধুয়ে রান্না করুন।',
            '',
            'আপনার আর কী পরামর্শ লাগবে বলুন। 🌱'
          ].join('\n');
        }

        // Tea Garden / Sreemangal (শ্রীমঙ্গল / চা বাগান)
        if (/(চা বাগান|চা গাছ|cha bagan|\bcha\b|sreemangal|শ্রীমঙ্গল)/.test(m)) {
          return [
            '## শ্রীমঙ্গলে চা বাগান স্থাপন ও পরিচর্যার নির্দেশিকা:',
            '',
            '### ১. মাটি ও পরিবেশ নির্বাচন:',
            '- শ্রীমঙ্গলের পাহাড়ী ঢালু জমি ও অম্লীয় মাটি (pH ৪.৫ - ৫.৫) চা চাষের জন্য সবচেয়ে উপযুক্ত।',
            '- জমিতে পানি নিষ্কাশনের ভালো ব্যবস্থা থাকা আবশ্যক।',
            '',
            '### ২. ছায়া গাছ রোপণ:',
            '- কড়া রোদ থেকে কচি চা গাছ রক্ষায় কড়ই (Albizia) জাতীয় ছায়া গাছ রোপণ করুন।',
            '',
            '### ৩. পরিচর্যা ও পাতা সংগ্রহ:',
            '- চারা রোপণের পর নিয়মিত ছাঁটাই (Pruning) করে ঝোপালো আকৃতি দিন।',
            '- গুণগত মান বজায় রাখতে "দুইটি কচি পাতা ও একটি কুঁড়ি" নিয়মে পাতা চয়ন করুন।',
            '',
            'আপনার আর কী পরামর্শ লাগবে বলুন। 🌱'
          ].join('\n');
        }

        // Becoming a Good Farmer (সফল / ভালো কৃষক হওয়া)
        if (/(কৃষক|krisok|krishok|চাষী|ভালো কৃষক|সফল কৃষক|কৃষি কাজ)/.test(m)) {
          return [
            '## একজন সফল ও আধুনিক কৃষক হওয়ার মূল পরামর্শ:',
            '',
            '### ১. মাটি পরীক্ষা ও সুষম সার:',
            '- প্রতি মৌসুমে মাটি পরীক্ষা করে মাটির চাহিদা অনুযায়ী জৈব ও রাসায়নিক সার ব্যবহার করুন।',
            '',
            '### ২. আধুনিক প্রযুক্তি ও উন্নত জাত:',
            '- সার্টিফাইড বীজ এবং ব্রি/বারি উদ্ভাবিত উচ্চফলনশীল জাত চাষ করুন।',
            '- স্থানীয় উপ-সহকারী কৃষি কর্মকর্তার পরামর্শ গ্রহণ করুন।',
            '',
            '### ৩. ফসল পর্যায়ক্রম (Crop Rotation):',
            '- একই জমিতে বারবার একই ফসল না চাষ করে পর্যায়ক্রমে ডাল, শাকসবজি ও শস্য চাষ করুন। এতে মাটির উর্বরতা বৃদ্ধি পায়।',
            '',
            'আপনার আর কী পরামর্শ লাগবে বলুন। 🌱'
          ].join('\n');
        }

        // Mango / Fruit Trees (আম / ফল গাছ)
        if (/(আম গাছ|আম বাগান|aam|amm|\bআম\b|mango)/.test(m)) {
          return [
            '## বাংলাদেশে আম গাছ রোপণ ও পরিচর্যার নির্দেশিকা:',
            '',
            '### ১. জাত নির্বাচন:',
            '- বাংলাদেশে লাভজনক ও জনপ্রিয় জাত: **আম্রপালি, হাঁড়িভাঙা, বারি আম-৪, খীরসাপাত (ল্যাংড়া)**।',
            '',
            '### ২. মাদা/গর্ত প্রস্তুতকরণ:',
            '- ৩ ফুট x ৩ ফুট x ৩ ফুট আকারের গর্ত করে ১৫-২০ দিন রোদে শুকিয়ে নিন।',
            '- প্রতি গর্তে ১৫-২০ কেজি পচা গোবর, ৫০০ গ্রাম টিএসপি, ২৫০ গ্রাম এমওপি এবং ১০০ গ্রাম জিপসাম মাটির সাথে মিশিয়ে দিন।',
            '',
            '### ৩. কলমের চারা রোপণ ও পরিচর্যা:',
            '- জোড় কলমের সুস্থ চারা রোপণ করুন। চারা সোজা রাখার জন্য শক্ত খুঁটি পুঁতে দিন।',
            '- প্রথম কয়েক মাস নিয়মিত সেচ দিন, তবে গোড়ায় যেন পানি জমে না থাকে।',
            '',
            'আপনার আর কী পরামর্শ লাগবে বলুন। 🌱'
          ].join('\n');
        }

        // Red Spinach / Leafy Greens (লাল শাক / শাকসবজি)
        if (/(লাল শাক|lal shak|lal|shak|শাক|পালং|কপি|পুঁই)/.test(m)) {
          return [
            '## লাল শাক চাষের সহজ ও বৈজ্ঞানিক পরামর্শ:',
            '',
            '### ১. জমি ও মাটি প্রস্তুতকরণ:',
            '- ঝুরঝুরে ও সারযুক্ত দোআঁশ মাটি লাল শাক চাষের জন্য সবচেয়ে উপযোগী।',
            '- ভালো করে চাষ ও মই দিয়ে জমি সমান করে নিন।',
            '',
            '### ২. বীজ বপন:',
            '- শতক প্রতি ৪০-৫০ গ্রাম সুস্থ বীজ হালকা ছাই বা বালুর সাথে মিশিয়ে জমিতে ছিটিয়ে বা সারিতে বপন করুন।',
            '',
            '### ৩. পরিচর্যা ও ফসল সংগ্রহ:',
            '- বীজ গজানোর পর হালকা সেচ দিন। আগাছা থাকলে নিড়ানি দিয়ে পরিষ্কার করুন।',
            '- বপনের ২৫-৩০ দিনের মধ্যেই সতেজ লাল শাক সংগ্রহ করা যায়।',
            '',
            'আপনার আর কী পরামর্শ লাগবে বলুন। 🌱'
          ].join('\n');
        }

        // Water & Irrigation Management (পানি কম/বেশি / সেচ / পানি নিষ্কাশন)
        if (/(pani kom|pani beshi|pani|পানি|সেচ|নিষ্কাশন|ড্রেনেজ|অতিরিক্ত পানি)/.test(m)) {
          return [
            '## জমিতে পানি ব্যবস্থাপনা ও সেচ নির্দেশিকা:',
            '',
            '### ১. জমিতে পানি বেশি হলে (জলজট):',
            '- দ্রুত নিষ্কাশন নালা কেটে জমিতে জমে থাকা অতিরিক্ত পানি বের করে দিন।',
            '- জমা পানি দীর্ঘক্ষণ থাকলে গাছের শিকড় পচে যায়। পানি নিষ্কাশনের পর হাল্কা পটাশ সার দিতে পারেন।',
            '',
            '### ২. জমিতে পানি কম হলে (খরা/শুষ্কতা):',
            '- সকালে বা বিকেলে জমিতে পরিমিত সেচ দিন।',
            '- মাটির আর্দ্রতা ধরে রাখতে খড় বা কলার পাতা দিয়ে মালচিং (Mulching) করতে পারেন।',
            '',
            'আপনার আর কী পরামর্শ লাগবে বলুন। 🌱'
          ].join('\n');
        }

        // Weather & Risks (আবহাওয়া / বৃষ্টি / ঝুঁকি / Weather)
        if (/(weather|আবহাওয়া|আবহাওয়া|বৃষ্টি|ঝড়|ঝড়ো|ঝুঁকি|risk|রোদ)/.test(m)) {
          return [
            '## আবহাওয়া সম্পর্কিত পরামর্শ ও সতর্কবার্তা:',
            '',
            '### ১. অতিবৃষ্টি বা ঝড়-বৃষ্টির সম্ভাবনা থাকলে:',
            '- পাকা ধান বা ফসল থাকলে দ্রুত কেটে ঘরে তুলুন।',
            '- ক্ষেতের ড্রেন পরিষ্কার রাখুন এবং বৃষ্টি চলাকালীন সার বা বালাইনাশক স্প্রে করবেন না।',
            '',
            '### ২. তীব্র দাবদাহ বা খরার সময়:',
            '- গাছের কচি ডাল ও পাতা রক্ষায় ভোরে বা শেষ বিকেলে সেচ প্রদান করুন।',
            '',
            'আপনার আর কী পরামর্শ লাগবে বলুন। 🌱'
          ].join('\n');
        }

        // Pesticide Application Guidance (পেস্টিসাইড / বালাইনাশক / স্প্রে করার সময়)
        if (/(pesticide|বালাইনাশক|স্প্রে|পেস্টিসাইড|কখন স্প্রে|স্প্রে করার সময়)/.test(m)) {
          return [
            '## বালাইনাশক/পেস্টিসাইড স্প্রে করার সঠিক সময় ও নির্দেশিকা:',
            '',
            '### ১. সঠিক সময় নির্বাচন:',
            '- **সর্বোত্তম সময়:** রৌদ্রোজ্জ্বল দিনে **বিকেলের দিকে** (বিকাল ৩টা-৫টা) অথবা সকালে শিশির শুকানোর পর স্প্রে করুন।',
            '- কড়া রোদে বা বৃষ্টির সম্ভাবনার আগে স্প্রে করা যাবে না।',
            '',
            '### ২. সুরক্ষামূলক নিয়মাবলী:',
            '- বাতাসের বিপরীতে স্প্রে করবেন না, বাতাসের অনুকূলে স্প্রে করুন।',
            '- মাস্ক ও গ্লাভস পরে স্প্রে সম্পন্ন করুন।',
            '',
            'আপনার আর কী পরামর্শ লাগবে বলুন। 🌱'
          ].join('\n');
        }

        // Market Price & Profitability (দাম / বাজার দর / profit / লাভ)
        if (/(dam|দাম|বাজার দর|বাজারদর|দাম কত|লাভজনক|profit|লাভ)/.test(m)) {
          return [
            '## ফসলের বাজারদর ও লাভজনক চাষের পরামর্শ:',
            '',
            '### ১. বাজারদর যাচাই:',
            '- আপনার নিকটস্থ পাইকারি বা কিষাণ বাজারে দৈনিক বাজারদর যাচাই করে ফসল বিক্রি করুন।',
            '',
            '### ২. বেশি লাভের জন্য করণীয়:',
            '- মরশুমের শুরুতেই (Early Harvest) ফসল বাজারে তুলতে পারলে দ্বিগুণ দাম পাওয়া যায়।',
            '- উচ্চমূল্যের ফসল (যেমন: ড্রাগন ফল, ক্যাপসিকাম, সাম্মাম, কূল ও স্ট্রবেরি) চাষ করলে বেশি মুনাফা হয়।',
            '',
            'আপনার আর কী পরামর্শ লাগবে বলুন। 🌱'
          ].join('\n');
        }

        // Livestock / Cattle Care (গরু / ছাগল / পশু / হাঁস-মুরগি)
        if (/(goru|chagol|গরু|ছাগল|পশু|গবাদি|হাস|মুরগি|livestock|পশু চিকিৎসা)/.test(m)) {
          return [
            '## গবাদি পশু ও হাঁস-মুরগির যত্ন ও স্বাস্থ্য পরামর্শ:',
            '',
            '### ১. লক্ষণ ও প্রাথমিক যত্ন:',
            '- পশু খাদ্য খাওয়া বন্ধ করলে বা ঝিমোলে তাকে আলাদা স্থানে রাখুন।',
            '- পরিষ্কার ও নিরাপদ সুপেয় পানি পান করান এবং দানাদার খাবারের সাথে খনিজ মিশ্রণ দিন।',
            '',
            '### ২. টিকাদান ও প্রতিষেধক:',
            '- তড়কা, ক্ষুরা রোগ বা পিপিআর (PPR) রোগের বিরুদ্ধে সময়মত টিকা দিন।',
            '- জটিল লক্ষণে অবিলম্বে নিকটস্থ উপজেলা প্রাণিসম্পদ কর্মকর্তার সাথে যোগাযোগ করুন।',
            '',
            'আপনার আর কী পরামর্শ লাগবে বলুন। 🌱'
          ].join('\n');
        }

        // Cost Optimization (খরচ কমানো / Farming Cost)
        if (/(cost|komabo|কমাবো|খরচ|কম খরচে|খরচ কমানো|বাজেট)/.test(m)) {
          return [
            '## কৃষি উৎপাদন খরচ কমানোর সেরা উপায়:',
            '',
            '### ১. জৈব সার ও কম্পোস্ট ব্যবহার:',
            '- রাসায়নিক সারের খরচ কমাতে বাড়িতে তৈরি গোবর, সবুজ সার ও কম্পোস্ট ব্যবহার করুন।',
            '',
            '### ২. নিজস্ব বীজ সংরক্ষণ:',
            '- প্রতি বছর বীজ না কিনে ভালো ফলনের গাছ থেকে বীজ সংগ্রহ ও শোধন করে রাখুন।',
            '',
            '### ৩. পার্চিং ও জৈব ফাঁদ (IPM):',
            '- পোকা মারতে দামী কীটনাশক না কিনে ক্ষেতে ডাল পুঁতে (পার্চিং) পাখি বসান ও হলুদ ফাঁদ ব্যবহার করুন।',
            '',
            'আপনার আর কী পরামর্শ লাগবে বলুন। 🌱'
          ].join('\n');
        }

        // Fertilizer / Soil (সার / মাটি)
        if (/(সার|sar|fertilizer|ইউরিয়া|টিএসপি|মাটি|mati|গোবর)/.test(m)) {
          return [
            '## সুষম সার ও মাটি ব্যবস্থাপনা পরামর্শ:',
            '',
            '### সুষম সার প্রয়োগ নির্দেশিকা:',
            '১. রাসায়নিক সারের সাথে অবশ্যই পর্যাপ্ত জৈব সার/কম্পোস্ট ব্যবহার করুন।',
            '২. ইউরিয়া সার একবারে না দিয়ে ২-৩ কিস্তিতে রৌদ্রোজ্জ্বল দিনে বিকেলে প্রয়োগ করুন।',
            '৩. পটাশ (MOP) সার প্রয়োগ করলে গাছের রোগ প্রতিরোধ ক্ষমতা বৃদ্ধি পায়।',
            '',
            'আপনার আর কী পরামর্শ লাগবে বলুন। 🌱'
          ].join('\n');
        }

        // General / Default response
        return [
          `## চাষাবাদ ও ফসল পরামর্শ:`,
          `আপনার বার্তা "${msg}" বিশ্লেষণ করা হয়েছে।`,
          '',
          '### সাধারণ কৃষি দিকনির্দেশনা:',
          '১. ভালো ফলনের জন্য উপযুক্ত সময়ে উন্নত জাতের সার্টিফাইড বীজ ব্যবহার করুন।',
          '২. জমি তৈরিতে সুষম পরিমাণে গোবর বা জৈব সার প্রয়োগ করুন।',
          '৩. ক্ষেতে সুষম সেচ বজায় রাখুন এবং পোকা বা রোগের লক্ষণ দেখা দিলে প্রয়োজনীয় সমাধান নিন।',
          '',
          'আপনার আর কী পরামর্শ লাগবে বলুন। 🌱'
        ].join('\n');
      };

      const AGRI_SYSTEM_PROMPT = `
AgriMind AI, a professional agricultural assistant for Bangladesh farmers.

- Answer in Bengali.
- Understand Bengali, English and Banglish.
- Provide practical farming solutions.
- Act like an experienced agriculture consultant.
- Explain crop diseases, fertilizer, irrigation, soil, pests and cultivation methods.
- Ask follow-up questions when information is insufficient.
- Do not give random answers.
- Use markdown formatting.
- End every answer with:

"আপনার আর কী পরামর্শ লাগবে বলুন। 🌱"
`.trim();

      if (!process.env.OPENAI_API_KEY) {
        return res.json({
          success: true,
          role: activeRole,
          reply: buildSmartFallback(cleanMessage),
          source: 'fallback',
        });
      }

      try {
        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

        const completion = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          temperature: 0.7,
          max_tokens: 1200,
          messages: [
            { role: 'system', content: AGRI_SYSTEM_PROMPT },
            { role: 'user', content: cleanMessage },
          ],
        });

        const reply = completion.choices[0]?.message?.content?.trim();

        if (!reply) {
          return res.json({
            success: true,
            role: activeRole,
            reply: buildSmartFallback(cleanMessage),
            source: 'fallback',
          });
        }

        return res.json({
          success: true,
          role: activeRole,
          reply,
          source: 'openai',
        });

      } catch (error: any) {
        console.error('[AI Chat] OpenAI Error:', error?.message ?? error);
        return res.json({
          success: true,
          role: activeRole,
          reply: buildSmartFallback(cleanMessage),
          source: 'fallback',
        });
      }
    });




    app.post('/api/store-payment', async (req, res) => {
      try {
        const { productId, productName, buyerName, buyerEmail, transactionId, amount } = req.body;

        if (!productId || !buyerEmail) {
          return res.status(400).json({ success: false, error: 'Missing parameters' });
        }

        const paymentInfo = {
          productId,
          productName,
          buyerName,
          buyerEmail,
          transactionId,
          amount,
          status: "success",
          paidAt: new Date().toISOString()
        };

        await paymentsCollaction.insertOne(paymentInfo);

        await productsCollaction.updateOne(
          { _id: new ObjectId(productId) },
          {
            $set: {
              availability: 'Unavailable',
              buyerEmail: buyerEmail,
              buyerName: buyerName
            }
          }
        );

        return res.json({ success: true, message: "Successfully sync database from Next.js Server Component." });
      } catch (error: any) {
        return res.status(500).json({ success: false, error: error.message });
      }
    });

    app.post('/api/usercollaction', async (req, res) => {
      const userdocs = req.body;
      const result = await userCollaction.insertOne(userdocs);
      res.json(result);
    });

    app.get('/api/own/usercollaction', async (req, res) => {
      try {
        const query: { email?: string } = {};
        if (req.query.email) {
          query.email = req.query.email as string;
        }

        const cursor = await userCollaction.findOne(query);
        res.json(cursor);
      } catch (err: any) { res.status(500).json({ error: err.message }); }
    });
    app.get('/api/usercollaction', async (req, res) => {
      try {
        const cursor = await userCollaction.find().toArray()
        res.json(cursor);
      } catch (err: any) { res.status(500).json({ error: err.message }); }
    });

    app.post('/api/products', async (req, res) => {
      const products = req.body;
      const result = await productsCollaction.insertOne(products);
      res.json(result);
    });

    app.get('/api/products', async (req, res) => {
      try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 20;
        const skip = (page - 1) * limit;

        const totalProducts = await productsCollaction.countDocuments();
        const result = await productsCollaction.find()
          .skip(skip)
          .limit(limit)
          .toArray();

        res.json({
          success: true,
          products: result,
          totalProducts,
          totalPages: Math.ceil(totalProducts / limit),
          currentPage: page
        });
      } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
      }
    });

    app.post('/api/publicchat', async (req, res) => {
      const publicchat = req.body;
      const result = await publicchatCollaction.insertOne(publicchat);
      res.json(result);
    });

    app.get('/api/publicchat', async (req, res) => {
      const cursor = await publicchatCollaction.find().toArray();
      res.json(cursor);
    });

    app.patch('/api/own/usercollaction', async (req, res) => {
      try {
        const query: { email?: string } = {};
        const updateData = req.body;
        if (req.query.email) {
          query.email = req.query.email as string;
        }
        const updateDocument = { $set: { ...updateData } };
        const cursor = await userCollaction.updateOne(query, updateDocument);
        const result = await users.updateOne({ email: req.query.email as string }, {
          $set: {
            name: updateData.name,
            image: updateData.image
          }
        });
        res.json({ cursor, result });
      } catch (err: any) { res.status(500).json({ error: err.message }); }
    });

    app.patch('/api/usercollaction/makeblock', async (req, res) => {
      try {
        const query: { email?: string } = {};
        if (req.query.email) {
          query.email = req.query.email as string;
        }
        const updateDocument = { $set: { status: 'blocked' } };

        const result = await userCollaction.updateOne(query, updateDocument);
        res.json(result);
      } catch (err: any) { res.status(500).json({ error: err.message }); }
    });

    app.patch('/api/usercollaction/unblocked', async (req, res) => {
      try {
        const query: { email?: string } = {};
        if (req.query.email) {
          query.email = req.query.email as string;
        }
        const updateDocument = { $set: { status: 'active' } };

        const result = await userCollaction.updateOne(query, updateDocument);
        res.json(result);
      } catch (err: any) { res.status(500).json({ error: err.message }); }
    });

    app.get('/api/pegination/users', async (req, res) => {
      try {
        const { page = 1, limit = 10 } = req.query;
        const skip = (Number(page) - 1) * Number(limit);
        const result = await userCollaction.find().skip(skip).limit(Number(limit)).toArray();
        const totalData = await userCollaction.countDocuments();
        const totalPage = Math.ceil(totalData / Number(limit));
        res.json({ data: result, page: Number(page), totalPage });
      } catch (err: any) { res.status(500).json({ error: err.message }); }
    });
   

    app.post('/api/start', async (req, res) => {
      try {
        const info = req.body;
        const insertResult = await start.insertOne(info);
        const totalCount = await start.countDocuments({
          productId: info.productId,
          actionType: "star_rating"
        });

        res.json({
          success: true,
          result: insertResult,
          count: totalCount
        });
      } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
      }
    });

    app.get('/api/start/count/:productId', async (req, res) => {
      try {
        const productId = req.params.productId;
        const totalCount = await start.countDocuments({
          productId: productId,
          actionType: "star_rating"
        });
        res.json({ count: totalCount });
      } catch (error: any) {
        res.status(500).json({ success: false, count: 0 });
      }
    });

    app.get('/api/products/:id', async (req, res) => {
      try {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        const result = await productsCollaction.findOne(query);
        res.json(result);
      } catch (error: any) { res.status(500).json({ success: false, message: error.message }); }
    });

    app.patch('/api/products/:id', async (req, res) => {
      try {
        const id = req.params.id;
        const updateData = req.body;
        const query = { _id: new ObjectId(id) };
        const updateDocument = { $set: { ...updateData } };
        const result = await productsCollaction.updateOne(query, updateDocument);
        res.json(result);
      } catch (error: any) { res.status(500).json({ success: false, message: error.message }); }
    });

    app.delete('/api/farmer/products/:id', async (req, res) => {
      try {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        const result = await productsCollaction.deleteOne(query);
        res.json(result);
      } catch (error: any) { res.status(500).json({ success: false, message: error.message }); }
    });

    app.patch('/api/farmer/products/confirm/:id', async (req, res) => {
      try {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        const result = await productsCollaction.updateOne(query, { $set: { availability: 'Unavailable' } });
        res.json(result);
      } catch (error: any) { res.status(500).json({ success: false, message: error.message }); }
    });

  } finally {
    // Keep connection alive
  }
}
run().catch(console.dir);

app.get('/', (req, res) => {
  res.send('Hello World!');
});

app.listen(port, () => {
  console.log(`Server listening on PORT ${port}`);
  if (!process.env.OPENAI_API_KEY) {
    console.warn("\x1b[33m%s\x1b[0m", "⚠️  WARNING: OPENAI_API_KEY is not defined in your environment — AI route will use smart fallback data.");
  } else {
    console.log("✅ OPENAI_API_KEY is configured correctly.");
  }
});