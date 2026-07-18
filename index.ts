import express from "express";
import type { Express } from "express";
import { MongoClient, ServerApiVersion, ObjectId } from "mongodb";
import cors from "cors";
import dotenv from "dotenv";


dotenv.config();

const app: Express = express();
const port: number = Number(process.env.PORT) || 8000;
app.use(cors());
app.use(express.json())

const uri = process.env.MONGODB_URI

const client = new MongoClient(uri!, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});



async function run() {
  try {



    const database = client.db(process.env.MONGODB_DB)
    const userCollaction = database.collection('usercollaction')
    const users = database.collection('user')
    const productsCollaction = database.collection('products')
    const publicchatCollaction = database.collection('publicchat')

    app.post('/api/usercollaction', async (req, res) => {
      const userdocs = req.body
      const result = await userCollaction.insertOne(userdocs)
      res.json(result)
    })

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
      const products = req.body
      const result = await productsCollaction.insertOne(products)
      res.json(result)
    })

    app.post('/api/publicchat', async (req, res) => {
      const publicchat = req.body
      const result = await publicchatCollaction.insertOne(publicchat)
      res.json(result)
    })

    app.get('/api/publicchat', async (req, res) => {
      const cursor = await publicchatCollaction.find().toArray();
      res.json(cursor);
    })

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








    // await client.connect();
    // await client.db("admin").command({ ping: 1 });
    // console.log("Pinged your deployment. You successfully connected to MongoDB!");




  } finally {

    // await client.close();
  }
}
run().catch(console.dir);






app.get('/', (req, res) => {
  res.send('Hello World!')
})

app.listen(port, () => {
  console.log(`Example app listening on PORT ${port}`)
})