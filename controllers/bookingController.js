import Booking from "../models/Booking.js";
import ChargingStation from "../models/ChargingStation.js";
import Slot from "../models/Slot.js";
import User from "../models/User.js";
import { sendEmail } from "../utils/sendEmail.js";

// ---------------- User: Create booking ----------------
export const createBooking = async (req, res) => {
  try {
    const user_id = req.user._id;
    const { slot_id, station_id, booking_date, start_time, end_time } = req.body;

    if (!slot_id || !station_id || !booking_date || !start_time || !end_time) {
      return res.status(400).json({ message: "All fields are required" });
    }

    // Convert booking_date to Date for comparison
    const bookingDay = new Date(booking_date);

    // Step 1: Check if user has overlapping booking at the station
    const overlappingUserBooking = await Booking.findOne({
      user_id,
      station_id,
      booking_date: bookingDay,
      booking_status: { $in: ["pending", "approved"] },
      $or: [
        { start_time: { $lt: end_time }, end_time: { $gt: start_time } },
        { start_time: { $lt: start_time }, end_time: { $gt: end_time } },
      ],
    });

    if (overlappingUserBooking) {
      return res.status(400).json({ message: "You already have a booking at this station during this time" });
    }

    // Step 2: Check if slot is available
    const slotBooked = await Booking.findOne({
      slot_id,
      station_id,
      booking_date: bookingDay,
      booking_status: { $in: ["pending", "approved"] },
      $or: [
        { start_time: { $lt: end_time }, end_time: { $gt: start_time } },
        { start_time: { $lt: start_time }, end_time: { $gt: end_time } },
      ],
    });

    if (slotBooked) {
      return res.status(400).json({ message: "This slot is already booked for the given time" });
    }

    // Step 3: Check station availability
    const station = await ChargingStation.findById(station_id);
    if (!station) return res.status(404).json({ message: "Station not found" });
    if (station.available_slots <= 0) return res.status(400).json({ message: "No available slots at this station" });

    // Step 4: Create booking
    const booking = await Booking.create({
      user_id,
      slot_id,
      station_id,
      booking_date: bookingDay,
      start_time,
      end_time,
    });

    res.status(201).json({ message: "Booking request sent", booking_id: booking._id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// ---------------- User: Update pending booking ----------------
export const updateBooking = async (req, res) => {
  try {
    const user_id = req.user._id;
    const { id } = req.params;
    const { slot_id, station_id, booking_date, start_time, end_time } = req.body;

    const booking = await Booking.findOne({ _id: id, user_id, booking_status: "pending" });
    if (!booking) return res.status(400).json({ message: "Booking cannot be updated" });

    const bookingDay = new Date(booking_date);

    // Check overlapping bookings for user
    const overlappingUserBooking = await Booking.findOne({
      _id: { $ne: id },
      user_id,
      station_id,
      booking_date: bookingDay,
      booking_status: { $in: ["pending", "approved"] },
      $or: [
        { start_time: { $lt: end_time }, end_time: { $gt: start_time } },
        { start_time: { $lt: start_time }, end_time: { $gt: end_time } },
      ],
    });

    if (overlappingUserBooking) {
      return res.status(400).json({ message: "You already have a booking at this station during this time" });
    }

    // Check slot availability
    const slotBooked = await Booking.findOne({
      _id: { $ne: id },
      slot_id,
      station_id,
      booking_date: bookingDay,
      booking_status: { $in: ["pending", "approved"] },
      $or: [
        { start_time: { $lt: end_time }, end_time: { $gt: start_time } },
        { start_time: { $lt: start_time }, end_time: { $gt: end_time } },
      ],
    });

    if (slotBooked) return res.status(400).json({ message: "This slot is already booked for the given time" });

    // Update booking
    booking.slot_id = slot_id;
    booking.station_id = station_id;
    booking.booking_date = bookingDay;
    booking.start_time = start_time;
    booking.end_time = end_time;

    await booking.save();
    res.json({ message: "Booking updated successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// ---------------- User: Cancel pending booking ----------------
export const cancelBooking = async (req, res) => {
  try {
    const user_id = req.user._id;
    const { id } = req.params;

    const booking = await Booking.findOne({ _id: id, user_id, booking_status: "pending" });
    if (!booking) return res.status(400).json({ message: "Booking cannot be cancelled" });

    booking.booking_status = "cancelled";
    await booking.save();

    // Increment station available slots
    await ChargingStation.findByIdAndUpdate(booking.station_id, { $inc: { available_slots: 1 } });

    res.json({ message: "Booking cancelled successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// ---------------- Admin: Approve booking ----------------
export const approveBooking = async (req, res) => {
  try {
    const { id } = req.params;

    const booking = await Booking.findById(id).populate("user_id slot_id station_id");
    if (!booking) return res.status(404).json({ message: "Booking not found" });

    booking.booking_status = "approved";
    await booking.save();

    // Decrease station available slots
    await ChargingStation.findByIdAndUpdate(booking.station_id._id, { $inc: { available_slots: -1 } });

    // Send email
    try {
      await sendEmail(
        booking.user_id.email,
        "Booking Confirmed",
        `<h2>Hello ${booking.user_id.name},</h2>
         <p>Your booking has been <b>approved</b> 🎉</p>
         <ul>
           <li>Station: ${booking.station_id.station_name}</li>
           <li>Slot: ${booking.slot_id.slot_number}</li>
           <li>Date: ${booking.booking_date.toDateString()}</li>
           <li>Time: ${booking.start_time} - ${booking.end_time}</li>
         </ul>`
      );
    } catch (emailErr) {
      console.error("Email sending failed:", emailErr);
    }

    res.json({ message: "Booking approved" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// ---------------- Admin: Reject booking ----------------
export const rejectBooking = async (req, res) => {
  try {
    const { id } = req.params;
    const booking = await Booking.findById(id);
    if (!booking) return res.status(404).json({ message: "Booking not found" });

    booking.booking_status = "rejected";
    await booking.save();

    res.json({ message: "Booking rejected" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// ---------------- User: List their bookings ----------------
export const userBookings = async (req, res) => {
  try {
    const user_id = req.user._id;

    const bookings = await Booking.find({ user_id })
      .populate("station_id", "station_name")
      .populate("slot_id", "slot_number");

    res.json({ bookings });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// ---------------- Admin: List pending bookings ----------------
export const listPendingBookings = async (req, res) => {
  try {
    const bookings = await Booking.find({ booking_status: "pending" })
      .populate("user_id", "name email")
      .populate("station_id", "station_name")
      .populate("slot_id", "slot_number");

    res.json({ bookings });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};
