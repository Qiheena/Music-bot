const express = require("express");
const app = express();

app.get("/", (req, res) => res.send("Bot is running!"));

app.listen(process.env.PORT || 5000, () => {
  console.log("Express server running...");
});
