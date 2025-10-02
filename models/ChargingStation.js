import mongoose from "mongoose";

const chargingStationSchema = new mongoose.Schema(
  {
    station_name: {
      type: String,
      required: true,
      unique: true, // ensures unique station names
      trim: true,
    },
    location: {
      type: String,
      required: true,
      trim: true,
    },
    total_slots: {
      type: Number,
      required: true,
      min: 1,
    },
    available_slots: {
      type: Number,
      required: true,
      min: 0,
    },
    charging_type: {
      type: String,
      enum: ["fast", "slow"],
      required: true,
    },
    station_status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },
  },
  { timestamps: true }
);

const ChargingStation = mongoose.model("ChargingStation", chargingStationSchema);
export default ChargingStation;
