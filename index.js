import express from "express";
import dotenv from "dotenv";

const PORT = process.env.PORT || 3000;

const app = express();

app.get("/", (req, res) => {
  res.send("Hello World! from node");
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
