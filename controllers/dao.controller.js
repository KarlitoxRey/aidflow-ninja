import Dao from "../models/Dao.js";

export const getDaoBalance = async (req, res) => {
  const dao = await Dao.findOne();
  res.json({ balance: dao?.balance || 0 });
};

export const addToDao = async (req, res) => {
  const { amount } = req.body;
  const dao = await Dao.findOne() || await Dao.create({ balance: 0 });
  dao.balance += amount;
  await dao.save();
  res.json({ message: "DAO actualizado", balance: dao.balance });
};
