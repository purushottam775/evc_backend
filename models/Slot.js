import mongoose from "mongoose";

const slotSchema = new mongoose.Schema(
  {
    station_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ChargingStation",
      required: true,
    },
    slot_number: {
      type: Number,
      required: true,
      min: 1,
    },
    slot_status: {
      type: String,
      enum: ["available", "occupied", "maintenance"],
      default: "available",
    },
  },
  { timestamps: true }
);

// Ensure unique slot number per station
slotSchema.index({ station_id: 1, slot_number: 1 }, { unique: true });

const Slot = mongoose.model("Slot", slotSchema);

export default Slot;
