// const mongoose = require("mongoose");

// async function connectDB() {
//   if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is missing in backend/.env");
//   await mongoose.connect(process.env.MONGODB_URI);
//   console.log("MongoDB connected successfully");
// }
// module.exports = connectDB;


import mongoose from "mongoose";

async function connectDB() {
  const mongoURI = process.env.MONGODB_URI;

  if (!mongoURI) {
    throw new Error("MONGODB_URI is missing from environment variables");
  }

  await mongoose.connect(mongoURI);
  console.log("MongoDB connected successfully");
}

export default connectDB;
