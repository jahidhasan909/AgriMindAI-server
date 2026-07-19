import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

import express from "express";
import type { Express } from "express";
import { MongoClient, ServerApiVersion, ObjectId } from "mongodb";
import cors from "cors";
import Groq from "groq-sdk";

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