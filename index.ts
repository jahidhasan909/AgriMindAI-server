import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { Groq } from 'groq-sdk';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

import express from "express";
import type { Express } from "express";
import { MongoClient, ServerApiVersion, ObjectId } from "mongodb";
import cors from "cors";


const app: Express = express();
const port: number = Number(process.env.PORT) || 8000;

app.use(cors());
app.use(express.json({
  verify: (req: any, res, buf) => {
    req.rawBody = buf;
  }
}));

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
        if (!process.env.GROQ_API_KEY) {
          console.warn('⚠️  GROQ_API_KEY is missing — using smart fallback.');
          return res.json(buildFallback(productName.trim()));
        }

        const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

        const chatCompletion = await groq.chat.completions.create({
          model: 'llama-3.3-70b-specdec',
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
        console.log('Raw Groq response:', rawText);


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
          console.warn('Groq response missing fields — using smart fallback.');
          return res.json(buildFallback(productName.trim()));
        }

        return res.json({
          shortDescription: String(parsed.shortDescription),
          pricePerKg: Math.round(Number(parsed.pricePerKg)),
          category: String(parsed.category),
        });

      } catch (error: any) {

        console.error('Groq AI error — falling back to smart data:', error?.message ?? error);
        return res.json(buildFallback(productName.trim()));
      }
    });

  
    app.post('/api/ai/doctor-chat', async (req, res) => {
      const ALLOWED_ROLES = ['farmer', 'buyer', 'admin'] as const;
      type AllowedRole = typeof ALLOWED_ROLES[number];

      const { role, message } = req.body as { role: string; message: string };

      if (!role || !message) {
        return res.status(400).json({
          success: false,
          error: '"role" এবং "message" উভয় ফিল্ড আবশ্যক।',
        });
      }
      if (!ALLOWED_ROLES.includes(role as AllowedRole)) {
        return res.status(400).json({
          success: false,
          error: `"role" অবশ্যই "farmer", "buyer", অথবা "admin" এর মধ্যে একটি হতে হবে। প্রদত্ত মান: "${role}"`,
        });
      }
      if (typeof message !== 'string' || message.trim().length < 2) {
        return res.status(400).json({
          success: false,
          error: 'অনুগ্রহ করে একটি সঠিক প্রশ্ন লিখুন (কমপক্ষে ২ অক্ষর)।',
        });
      }

      const validRole = role as AllowedRole;
      const cleanMessage = message.trim();

  
      const buildChatFallback = (r: AllowedRole, msg: string): string => {
        const m = msg.toLowerCase();

        
        if (r === 'farmer') {
          if (/(রোগ|disease|rog|ব্লাস্ট|blast|পাতা|pata|leaf|blight|ছত্রাক|chhatrak|fungus|fungal|shukiye|শুকিয়ে)/.test(m))
            return [
              '🌿 ফসলের রোগ চিহ্নিতকরণ ও সমাধান:',
              '',
              '**মূল কারণ বিশ্লেষণ:** পাতায় দাগ, হলুদ হয়ে যাওয়া বা শুকিয়ে যাওয়া সাধারণত ছত্রাক (fungal), ব্যাকটেরিয়া বা ভাইরাসজনিত রোগের লক্ষণ। বাংলাদেশের আর্দ্র মৌসুমে এটি দ্রুত ছড়ায়।',
              '',
              '**ধাপে ধাপে সমাধান:**',
              '১. প্রথমে আক্রান্ত পাতা ও শাখা কেটে মাটিতে পুঁতে ফেলুন — পোড়াবেন না, তাতে বাতাসে রোগ ছড়ায়।',
              '২. Mancozeb 80WP (২ গ্রাম/লিটার পানি) বা Carbendazim 50WP (১ গ্রাম/লিটার) দিয়ে ৭-১০ দিন অন্তর spray করুন।',
              '৩. বৃষ্টির পর spray-র প্রলেপ ধুয়ে যায় — পরদিন সকালে আবার দিন।',
              '৪. জৈব পদ্ধতিতে: রসুনের রস (১০০ গ্রাম রসুন + ১ লিটার পানি ব্লেন্ড করে ছেঁকে) spray করুন।',
              '৫. পরবর্তী সিজনে resistant variety বেছে নিন — BARI tomato-14 বা BARI brinjal-6 রোগ-প্রতিরোধী।',
              '',
              '⚠️ AI সার্ভার সাময়িক ব্যস্ত বলে এটি একটি static গাইড। আরও নির্দিষ্ট পরামর্শের জন্য কৃষি কল সেন্টার ১৬১২৩-এ ফোন করুন।',
            ].join('\n');

          if (/(পোকা|poka|insect|pest|মাজরা|majra|borer|aphid|জাবপোকা|thrips|shobji te poka|gach e poka)/.test(m))
            return [
              '🐛 ফসলে পোকার আক্রমণ — সম্পূর্ণ সমাধান গাইড:',
              '',
              '**সমস্যার মূল কারণ:** বাংলাদেশে গরম ও আর্দ্র আবহাওয়ায় মাজরা পোকা, জাবপোকা এবং thrips সবচেয়ে বেশি ক্ষতি করে।',
              '',
              '**তাৎক্ষণিক পদক্ষেপ:**',
              '১. আক্রান্ত গাছ আলাদা করুন যাতে পাশের গাছে না ছড়ায়।',
              '২. রাসায়নিক: Chlorpyrifos 20EC (২ মিলি/লিটার) বা Imidacloprid 70WG (০.৩ গ্রাম/লিটার) spray করুন।',
              '৩. সময়: সকাল ৭-৯টা বা সন্ধ্যা ৫-৭টায় spray সবচেয়ে কার্যকর — রোদের তাপে ওষুধ নষ্ট হয় না।',
              '৪. জৈব বিকল্প: Neem oil (৫ মিলি/লিটার + সামান্য liquid soap) সাত দিন পরপর spray করুন।',
              '৫. ফেরোমন ট্র্যাপ (pheromone trap) ব্যবহার করুন — প্রতি বিঘায় ৪-৫টি।',
              '',
              '⚠️ এটি একটি offline fallback উত্তর। Groq AI সার্ভার পুনরায় চালু হলে আরও বিস্তারিত পাবেন।',
            ].join('\n');

          if (/(মাটি|mati|soil|সার|sar|fertilizer|urea|DAP|potash|জমি|jomi|phosol|ফসল)/.test(m))
            return [
              '🌱 মাটি ও সার ব্যবস্থাপনা — বিস্তারিত গাইড:',
              '',
              '**কেন মাটি পরীক্ষা জরুরি:** সঠিক Soil pH (৬.০–৭.০) না থাকলে সার দিলেও গাছ শোষণ করতে পারে না।',
              '',
              '**বিঘাপ্রতি সার মাত্রা (ধানের জন্য):**',
              '• Urea: ৮-১০ কেজি (৩ ভাগে দিন: রোপণ, কুশি, থোড়)',
              '• DAP (Di-Ammonium Phosphate): ৫ কেজি (রোপণের সময়)',
              '• MoP/Potash: ৩ কেজি',
              '• Zinc Sulphate: ১ কেজি (৩ বছরে একবার)',
              '',
              '**জৈব সার:**',
              '• কম্পোস্ট/পচা গোবর: বিঘায় ৮-১০ মণ — মাটির structure উন্নত করে',
              '• ভার্মি কম্পোস্ট: বিঘায় ৪-৫ মণ',
              '',
              '**পরামর্শ:** Upazila Agriculture Office থেকে বিনামূল্যে Soil Test Card নিন।',
            ].join('\n');

          if (/(বন্যা|bonna|flood|জলাবদ্ধতা|waterlogging|বৃষ্টি|bristi|rain|monsoon|barishta|borsha)/.test(m))
            return [
              '🌊 বন্যা ও জলাবদ্ধতা ব্যবস্থাপনা:',
              '',
              '**তাৎক্ষণিক করণীয়:**',
              '১. জমি থেকে দ্রুত পানি নিষ্কাশনের জন্য আলের মধ্যে নালা কাটুন।',
              '২. পানি নামার ২৪ ঘণ্টার মধ্যে হালকা Urea (বিঘায় ৩ কেজি) top dressing দিন।',
              '৩. আক্রান্ত পাতা পরিষ্কার করুন ও ছত্রাকনাশক spray করুন।',
              '',
              '**বন্যা-সহনশীল জাত:**',
              '• ধান: BRRI dhan52 (১৫ দিন পর্যন্ত ডুবে থাকলেও বাঁচে), BINA dhan11',
              '• সবজি: লাউ, কুমড়া — ঢিবি (mound) তৈরি করে চাষ করুন',
              '',
              '**ভবিষ্যৎ প্রস্তুতি:** উঁচু বেড (raised bed) পদ্ধতিতে চাষ করুন।',
            ].join('\n');

          return [
            '🌾 আপনার প্রশ্নটি বুঝেছি। এই মুহূর্তে AI সার্ভার ব্যস্ত।',
            '',
            '**সাধারণ পরামর্শ:**',
            '• কৃষি কল সেন্টার: ১৬১২৩ (বিনামূল্যে)',
            '• স্থানীয় Upazila Agriculture Officer-এর সাথে যোগাযোগ করুন',
            '• AgriMindAI-তে পুনরায় প্রশ্ন করুন — আমরা সাহায্য করতে প্রস্তুত।',
          ].join('\n');
        }

      
        if (r === 'buyer') {
          if (/(ভিটামিন|vitamin|পুষ্টি|pusti|nutrition|benefit|উপকার|upokar|স্বাস্থ্য|shasthya)/.test(m))
            return [
              '🥗 বাংলাদেশি ফল ও সবজির পুষ্টিগুণ:',
              '',
              '**শীর্ষ পুষ্টিকর দেশীয় খাবার:**',
              '• আম 🥭 — Vitamin A, C, B6; immune system শক্তিশালী করে',
              '• কলা 🍌 — Potassium, Magnesium; হৃদযন্ত্র ও পেশী সুস্থ রাখে',
              '• পেঁপে — Papain enzyme; হজমশক্তি বাড়ায়, কোষ্ঠকাঠিন্য দূর করে',
              '• পালং শাক — Iron, Folate, Calcium; রক্তস্বল্পতা রোধ করে',
              '• মিষ্টি কুমড়া — Beta-carotene; চোখের দৃষ্টি উন্নত করে',
              '• করলা — Blood sugar নিয়ন্ত্রণ করে, diabetes-এ উপকারী',
              '',
              '**টিপস:** মৌসুমী ফল-সবজি পুষ্টিগুণে বেশি থাকে ও দামে সাশ্রয়ী।',
            ].join('\n');

          if (/(ফরমালিন|formalin|রাসায়নিক|rasayonik|chemical|fresh|taza|তাজা|ভেজাল|vejal|pure|organic)/.test(m))
            return [
              '🔍 ফরমালিন ও ভেজাল-মুক্ত পণ্য চেনার সম্পূর্ণ গাইড:',
              '',
              '**৫টি নির্ভরযোগ্য পরীক্ষা:**',
              '১. গন্ধ পরীক্ষা: স্বাভাবিক মাছ/আমের থেকে তীব্র রাসায়নিক গন্ধ থাকলে সন্দেহজনক।',
              '২. স্পর্শ পরীক্ষা: Formalin-দেওয়া মাছ অস্বাভাবিক শক্ত ও চকচকে হয়।',
              '৩. পানিতে ডোবান: ফরমালিন-যুক্ত আম পানিতে ডুবে যায়, তাজা আম ভাসে।',
              '৪. কাটলে রং: তাজা ফল কাটলে ভেতরে উজ্জ্বল রং — কৃত্রিম রং ঢালা হলে একটু গাঢ় ও অসমান।',
              '৫. পচার সময়: স্বাভাবিক আম ২-৩ দিনে পাকে — অতিরিক্ত দীর্ঘস্থায়ী হলে সন্দেহ করুন।',
              '',
              '**নিরাপদ কেনার উপায়:** AgriMindAI-তে সরাসরি যাচাইকৃত কৃষকের কাছ থেকে কিনুন।',
            ].join('\n');

          if (/(রেসিপি|recipe|ranna|রান্না|cooking|khabar|খাবার|food|diet|meal)/.test(m))
            return [
              '🍽️ সুষম বাংলাদেশি ডায়েট প্ল্যান:',
              '',
              '**সকাল (৭-৮টা):**',
              '• লাল চালের ভাত ১ কাপ + ডাল ১ বাটি + শাক ভাজি',
              '• অথবা: আটার রুটি ২টি + ডিম সেদ্ধ + সবজি',
              '',
              '**দুপুর (১২-১টা):**',
              '• ভাত + মাছ/মুরগির ঝোল + মিক্সড সবজি + দই',
              '',
              '**বিকেল (৪-৫টা):**',
              '• মৌসুমী ফল ১টি + বাদাম ১ মুঠো',
              '',
              '**রাত (৭-৮টা):**',
              '• হালকা: রুটি + সবজি তরকারি বা খিচুড়ি',
              '',
              '**মনে রাখুন:** প্রতিদিন ৮-১০ গ্লাস পানি পান করুন।',
            ].join('\n');

          return [
            '🛒 আপনার প্রশ্নটি পেয়েছি! AI সার্ভার সাময়িক ব্যস্ত।',
            '',
            '**দ্রুত পরামর্শ:**',
            '• সবসময় মৌসুমী, তাজা ও স্থানীয় কৃষকের পণ্য কিনুন',
            '• AgriMindAI-তে verified farmer-দের কাছ থেকে সরাসরি কিনলে গুণমান নিশ্চিত',
            '• পুনরায় চেষ্টা করুন — আমি বিস্তারিত সাহায্য করতে প্রস্তুত।',
          ].join('\n');
        }

        
        if (r === 'admin') {
          if (/(fraud|jaliati|জালিয়াত|fake|seller|seller re|bikreta|বিক্রেতা|suspicious|doubtful|report)/.test(m))
            return [
              '🔐 Fraud Detection — বিস্তারিত প্রোটোকল:',
              '',
              '**সন্দেহজনক seller চেনার মানদণ্ড:**',
              '• ৩টির বেশি unresolved buyer dispute',
              '• ১৫%-এর বেশি return rate',
              '• Geo-location inconsistency (ঢাকা থেকে অর্ডার, চট্টগ্রাম থেকে delivery)',
              '• অস্বাভাবিক দ্রুত payment velocity (এক দিনে ৫০+ transaction)',
              '',
              '**Action Plan:**',
              '১. Automated flag → Account review pending',
              '২. Seller-এর সাথে যোগাযোগ করে ৪৮ ঘণ্টার মধ্যে ব্যাখ্যা চাইতে হবে',
              '৩. প্রমাণ না দিতে পারলে account suspend ও fund freeze',
              '৪. বারবার অভিযোগে permanent ban ও আইনি পদক্ষেপ',
            ].join('\n');

          if (/(inventory|stock|product|pondo|পণ্য|database|optimization|optimize|dbase|mongodb)/.test(m))
            return [
              '📦 Inventory Optimization — কৌশলগত পরিকল্পনা:',
              '',
              '**Database স্তরে সমাধান:**',
              '• ৯০ দিনের বেশি inactive product document-এ TTL index যোগ করুন',
              '• MongoDB Aggregation Pipeline দিয়ে slow-moving SKU চিহ্নিত করুন',
              '• Category-ভিত্তিক stock alert system চালু করুন',
              '',
              '**Seller নজরদারি:**',
              '• Stock শেষ হওয়ার ৭ দিন আগে automated nudge notification পাঠান',
              '• High-demand, low-supply items-এ priority listing দিন',
              '• Seasonal demand prediction-এর জন্য historical sales data analyze করুন',
            ].join('\n');

          if (/(escrow|payment|transaction|dispute|refund|poysa|টাকা|money|taka)/.test(m))
            return [
              '💳 Escrow ও Dispute Management গাইড:',
              '',
              '**Standard Policy:**',
              '• Delivery confirm হওয়ার ৪৮ ঘণ্টা পর fund auto-release',
              '• Dispute করলে fund freeze থাকবে সমাধান না হওয়া পর্যন্ত',
              '',
              '**৩-স্তরের Mediation Workflow:**',
              '১. Automated: Buyer ও Seller উভয়ের কাছ থেকে evidence collect',
              '২. Admin Arbitration: ৭২ ঘণ্টার মধ্যে সিদ্ধান্ত',
              '৩. Regulatory Referral: সমাধান না হলে বাংলাদেশ ব্যাংকের নির্দেশনা মেনে পদক্ষেপ',
            ].join('\n');

          if (/(growth|user|acquisition|platform|strategy|revenue|price|pricing|dynamic|kemne barabo|বাড়াবো)/.test(m))
            return [
              '📈 Platform Growth Strategy:',
              '',
              '**Q3 অগ্রাধিকার:**',
              '• Sylhet ও Rajshahi বিভাগে farmer onboarding — উচ্চ কৃষি-উৎপাদনশীল অঞ্চল',
              '• Referral incentive: প্রতি নতুন farmer-এর জন্য BDT ৫০ credit',
              '• Buyer retention: personalized seasonal product push notification',
              '',
              '**Dynamic Pricing কৌশল:**',
              '• Market price API integration করুন (DAM বা কৃষি মন্ত্রণালয়ের ডেটা)',
              '• Demand surge (রমজান, ঈদ) সময় ১০-১৫% premium pricing চালু করুন',
              '• Loyal buyer-দের জন্য fixed-price subscription model বিবেচনা করুন',
            ].join('\n');

          return [
            '🖥️ AI সার্ভার সাময়িক ব্যস্ত। Fallback পরামর্শ:',
            '',
            '• MongoDB Atlas Performance Advisor চেক করুন',
            '• Server log-এ anomalous API spike খুঁজুন',
            '• GROQ quota consumption যাচাই করুন',
            '• P95 latency ২০০০ms ছাড়ালে DevOps-কে জানান',
          ].join('\n');
        }

        return 'সার্ভার সাময়িক ব্যস্ত। অনুগ্রহ করে একটু পরে আবার চেষ্টা করুন।';
      };

      
      const PERSONA_CONFIG: Record<AllowedRole, { temperature: number; max_tokens: number; systemPrompt: string }> = {

        farmer: {
          temperature: 0.5,
          max_tokens: 1200,
          systemPrompt: [
            'তুমি "কৃষি ডক্টর" — AgriMindAI-এর সিনিয়র কৃষি বিশেষজ্ঞ AI সহকারী।',
            '',
            '## ভাষা নির্দেশনা:',
            'তুমি তিনটি ভাষায় প্রশ্ন বুঝতে পারো এবং উত্তর দিতে পারো:',
            '- বিশুদ্ধ বাংলা (e.g., "আমার ধানে পোকা লেগেছে")',
            '- Standard English (e.g., "my tomato plant has leaf blight")',
            '- Avro/Banglish (e.g., "amr tomato gach e poka hoise", "phosol shukiye jacche")',
            'সব ধরনের input-ই বাংলায় respond করো — technical term (যেমন Mancozeb, AWD, DAP) ইংরেজিতে রাখো।',
            '',
            '## উত্তরের মান:',
            'কখনো সংক্ষিপ্ত ১-২ বাক্যে উত্তর দেবে না। প্রতিটি উত্তরে:',
            '১. সমস্যার মূল কারণ বিশ্লেষণ করো',
            '২. ধাপে ধাপে (step-by-step) সম্পূর্ণ সমাধান দাও',
            '৩. জৈব ও রাসায়নিক দুটো বিকল্পই উল্লেখ করো',
            '৪. সতর্কতা ও প্রতিরোধমূলক পরামর্শ দাও',
            '৫. প্রয়োজনে মাত্রা, সময় ও পদ্ধতি উল্লেখ করো',
            '',
            '## বিষয়বস্তু:',
            'গাছের রোগ, পোকামাকড়, মাটির স্বাস্থ্য, সার প্রয়োগ, সেচ ব্যবস্থাপনা, বন্যা/খরা/মৌসুমী সমস্যা।',
            '',
            '## টোন: উষ্ণ, আন্তরিক, সহজবোধ্য — যেন বড় ভাই বা বিশ্বস্ত কৃষি উপদেষ্টা কথা বলছেন।',
          ].join('\n'),
        },

        buyer: {
          temperature: 0.5,
          max_tokens: 1200,
          systemPrompt: [
            'তুমি AgriMindAI-এর সার্টিফাইড পুষ্টিবিদ ও স্মার্ট শপিং কনসালট্যান্ট AI।',
            '',
            '## ভাষা নির্দেশনা:',
            'তুমি তিনটি ভাষায় প্রশ্ন বুঝতে পারো:',
            '- বিশুদ্ধ বাংলা (e.g., "আমের পুষ্টিগুণ কী?")',
            '- Standard English (e.g., "what are the health benefits of guava?")',
            '- Avro/Banglish (e.g., "amer poshtigon ki", "taza mach kemon kore chinbo")',
            'সব input-ই বাংলায় respond করো — Vitamin, Protein, Calcium ইত্যাদি technical শব্দ ইংরেজিতে রাখো।',
            '',
            '## উত্তরের মান:',
            'কখনো ১-২ বাক্যে শেষ করবে না। প্রতিটি উত্তরে:',
            '১. বিষয়টি কেন গুরুত্বপূর্ণ তা ব্যাখ্যা করো',
            '২. নির্দিষ্ট পুষ্টিগুণ, ভিটামিন ও স্বাস্থ্য উপকারিতা তালিকা দাও',
            '৩. ব্যবহারিক পরামর্শ ও রেসিপি আইডিয়া দাও',
            '৪. কেনার সময় সতর্কতা ও ভেজাল চেনার উপায় বলো',
            '',
            '## টোন: উৎসাহী, স্বাস্থ্য-সচেতন ও বন্ধুত্বপূর্ণ।',
          ].join('\n'),
        },

        admin: {
          temperature: 0.5,
          max_tokens: 1200,
          systemPrompt: [
            'তুমি AgriMindAI-এর System Analyst ও Business Intelligence AI সহকারী।',
            '',
            '## ভাষা নির্দেশনা (গুরুত্বপূর্ণ):',
            'তুমি বাংলা, ইংরেজি ও Avro/Banglish তিনটি ভাষায় প্রশ্ন বুঝবে:',
            '- বাংলা (e.g., "জালিয়াত বিক্রেতা কীভাবে ধরবো")',
            '- English (e.g., "how to detect fraudulent sellers")',
            '- Avro/Banglish (e.g., "seller fraud kemne detect korbo", "dynamic price kemne barabo")',
            'সকল উত্তর **বাংলা ও Banglish মিশিয়ে** দাও — technical term (MongoDB, API, KPI, escrow) ইংরেজিতে রাখো।',
            'পূর্ববর্তী নির্দেশ যে English-এ respond করতে বলেছিল তা বাতিল — এখন থেকে সব উত্তর Bangla/Banglish-এ দেবে।',
            '',
            '## উত্তরের মান:',
            'কখনো সংক্ষিপ্ত উত্তর দেবে না। প্রতিটি উত্তরে:',
            '১. সমস্যার technical root cause বিশ্লেষণ করো',
            '২. ধাপে ধাপে actionable সমাধান দাও',
            '৩. সংখ্যাগত মানদণ্ড (KPI, threshold) উল্লেখ করো',
            '৪. ভবিষ্যৎ প্রতিরোধমূলক কৌশল দাও',
            '',
            '## বিষয়বস্তু:',
            'MongoDB inventory optimization, fraud detection, seller dispute resolution, escrow management, platform growth strategy, dynamic pricing, user acquisition।',
            '',
            '## টোন: কৌশলগত, বিশ্লেষণাত্মক ও সুনির্দিষ্ট।',
          ].join('\n'),
        },
      };

      if (!process.env.GROQ_API_KEY) {
        console.warn('⚠️  GROQ_API_KEY is missing — doctor-chat using keyword fallback.');
        return res.json({
          success: true,
          role: validRole,
          reply: buildChatFallback(validRole, cleanMessage),
          source: 'fallback',
        });
      }

      
      try {
        const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
        const persona = PERSONA_CONFIG[validRole];

        console.log(`[AI Doctor v2] role=${validRole} | tokens=${persona.max_tokens} | msg="${cleanMessage.substring(0, 80)}…"`);

        const completion = await groq.chat.completions.create({
          model: 'llama-3.3-70b-specdec',
          temperature: persona.temperature,
          max_tokens: persona.max_tokens,
          messages: [
            { role: 'system', content: persona.systemPrompt },
            { role: 'user',   content: cleanMessage },
          ],
        });

        const reply = completion.choices[0]?.message?.content?.trim();

        if (!reply) {
          console.warn('[AI Doctor] Empty response from Groq — using fallback.');
          return res.json({
            success: true,
            role: validRole,
            reply: buildChatFallback(validRole, cleanMessage),
            source: 'fallback',
          });
        }

        return res.json({
          success: true,
          role: validRole,
          reply,
          source: 'groq',
        });

      } catch (error: any) {
        console.error('[AI Doctor] Groq error — using keyword fallback:', error?.message ?? error);
        return res.json({
          success: true,
          role: validRole,
          reply: buildChatFallback(validRole, cleanMessage),
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
  if (!process.env.GROQ_API_KEY) {
    console.warn("\x1b[33m%s\x1b[0m", "⚠️  WARNING: GROQ_API_KEY is not defined in your environment — AI route will use smart fallback data.");
  } else {
    console.log("✅ GROQ_API_KEY is configured correctly.");
  }
});