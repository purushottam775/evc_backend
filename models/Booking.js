import mongoose from "mongoose";

const bookingSchema = new mongoose.Schema(
  {
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    slot_id: { type: mongoose.Schema.Types.ObjectId, ref: "Slot", required: true },
    station_id: { type: mongoose.Schema.Types.ObjectId, ref: "ChargingStation", required: true },
    booking_date: { type: Date, required: true },
    start_time: { type: String, required: true },
    end_time: { type: String, required: true },
    booking_status: {
      type: String,
      enum: ["pending", "approved", "rejected", "cancelled"],
      default: "pending",
    },
    payment_status: { type: String, enum: ["pending", "paid"], default: "pending" },
  },
  { timestamps: true }
);

const Booking = mongoose.model("Booking", bookingSchema);
export default Booking;
