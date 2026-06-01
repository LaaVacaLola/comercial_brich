// api/db.js
const mongoose = require("mongoose");

async function connectDB() {
  try {
    console.log("🔍 MONGO_URI USADO:", process.env.MONGO_URI);
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ MongoDB conectado");
  } catch (err) {
    console.error("❌ Error conectando a MongoDB:", err.message);
    process.exit(1);
  }
}

module.exports = { connectDB };
