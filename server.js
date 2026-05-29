require("dotenv").config();
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");

const app = express();
app.use(cors());
app.use(express.json());

mongoose.connect(process.env.MONGO_URI)
.then(()=>console.log("MongoDB connected"))
.catch(err=>console.log("MongoDB error:", err.message));

const userSchema = new mongoose.Schema({
  telegramId: { type: String, unique: true },
  name: String,
  balance: { type: Number, default: 0 },
  adsWatched: { type: Number, default: 0 },
  referrals: { type: Number, default: 0 },
  referredBy: String,
}, { timestamps: true });

const withdrawSchema = new mongoose.Schema({
  telegramId: String,
  method: String,
  account: String,
  amount: Number,
  status: { type: String, default: "pending" }
}, { timestamps: true });

const User = mongoose.model("User", userSchema);
const Withdraw = mongoose.model("Withdraw", withdrawSchema);

app.get("/", (req,res)=>res.send("Monetag Mini Bot Backend Running"));

app.post("/user", async (req,res)=>{
  const { telegramId, name, referralCode } = req.body;
  let user = await User.findOne({ telegramId });

  if(!user){
    user = await User.create({ telegramId, name, referredBy: referralCode || "" });

    if(referralCode && referralCode !== String(telegramId)){
      const refUser = await User.findOne({ telegramId: referralCode });
      if(refUser){
        refUser.referrals += 1;
        refUser.balance += 20;
        await refUser.save();
      }
    }
  }

  const withdraws = await Withdraw.countDocuments({ telegramId });
  res.json({...user.toObject(), withdraws});
});

app.post("/reward", async (req,res)=>{
  const { telegramId, reward = 10 } = req.body;
  const user = await User.findOne({ telegramId });
  if(!user) return res.json({message:"User not found"});

  user.balance += Number(reward);
  user.adsWatched += 1;
  await user.save();

  res.json({message:`Reward added: ${reward} coins`, balance:user.balance});
});

app.post("/withdraw", async (req,res)=>{
  const { telegramId, method, account, amount } = req.body;
  if(!method || !account || !amount) return res.json({message:"সব ঘর পূরণ করুন"});
  if(Number(amount) < 100) return res.json({message:"Minimum withdraw 100 coins"});

  const user = await User.findOne({ telegramId });
  if(!user) return res.json({message:"User not found"});
  if(user.balance < Number(amount)) return res.json({message:"Balance কম আছে"});

  user.balance -= Number(amount);
  await user.save();

  await Withdraw.create({ telegramId, method, account, amount });
  res.json({message:"Withdraw request submitted"});
});

app.get("/admin/users", async (req,res)=>{
  const users = await User.find().sort({createdAt:-1}).limit(200);
  res.json(users);
});

app.get("/admin/withdraws", async (req,res)=>{
  const withdraws = await Withdraw.find().sort({createdAt:-1}).limit(200);
  res.json(withdraws);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, ()=>console.log("Server running on", PORT));
