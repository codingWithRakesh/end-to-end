import { Schema, model } from "mongoose";

const privateKeySchema = new Schema({
  userId: { type: String, required: true },
  privateKey: { type: String, required: true },
});

const PrivateKey = model("PrivateKey", privateKeySchema);

export default PrivateKey;
