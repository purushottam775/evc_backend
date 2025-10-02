import Slot from "../models/Slot.js";
import ChargingStation from "../models/ChargingStation.js";

// ---------------- Admin: Add slot to station ----------------
export const addSlot = async (req, res) => {
  try {
    let { station_id, slot_number, slot_status } = req.body;

    if (!station_id || !slot_number || !slot_status) {
      return res.status(400).json({ success: false, message: "All fields are required" });
    }

    slot_number = parseInt(slot_number);
    slot_status = slot_status.toLowerCase();

    // Check station exists
    const station = await ChargingStation.findById(station_id);
    if (!station) return res.status(404).json({ success: false, message: "Station not found" });

    // Check total_slots limit
    const existingSlotsCount = await Slot.countDocuments({ station_id });
    if (existingSlotsCount >= station.total_slots) {
      return res.status(400).json({
        success: false,
        message: `Cannot add more slots. Station has reached its total limit of ${station.total_slots} slots.`,
      });
    }

    // Check duplicate slot_number
    const existingSlot = await Slot.findOne({ station_id, slot_number });
    if (existingSlot) {
      return res.status(400).json({ success: false, message: "Slot number already exists for this station" });
    }

    const newSlot = await Slot.create({ station_id, slot_number, slot_status });
    res.status(201).json({ success: true, message: "Slot added successfully", slot: newSlot });
  } catch (err) {
    console.error(err);
    if (err.code === 11000) {
      return res.status(400).json({ success: false, message: "Duplicate slot for this station" });
    }
    res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
};

// ---------------- Admin: Update slot ----------------
export const updateSlot = async (req, res) => {
  try {
    const { id } = req.params;
    const { slot_number, slot_status } = req.body;

    if (!slot_number && !slot_status) {
      return res.status(400).json({ success: false, message: "At least one field is required" });
    }

    const slot = await Slot.findById(id);
    if (!slot) return res.status(404).json({ success: false, message: "Slot not found" });

    // If updating slot_number, ensure it doesn't exceed station's total_slots
    if (slot_number) {
      const station = await ChargingStation.findById(slot.station_id);
      if (slot_number > station.total_slots) {
        return res.status(400).json({ success: false, message: "Slot number exceeds station total slots" });
      }

      const duplicateSlot = await Slot.findOne({
        station_id: slot.station_id,
        slot_number,
        _id: { $ne: slot._id },
      });
      if (duplicateSlot) return res.status(400).json({ success: false, message: "Slot number already exists" });

      slot.slot_number = slot_number;
    }

    if (slot_status) slot.slot_status = slot_status.toLowerCase();

    await slot.save();
    res.json({ success: true, message: "Slot updated successfully", slot });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
};

// ---------------- Admin: Get all slots ----------------
export const getAllSlots = async (req, res) => {
  try {
    const slots = await Slot.find().populate("station_id", "station_name total_slots");
    res.json({ success: true, slots });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
};

// ---------------- Admin/User: List slots of a station ----------------
export const listSlots = async (req, res) => {
  try {
    const { station_id } = req.params;
    const station = await ChargingStation.findById(station_id);
    if (!station) return res.status(404).json({ success: false, message: "Station not found" });

    const slots = await Slot.find({ station_id }).sort({ slot_number: 1 });
    res.json({ success: true, slots });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
};

// ---------------- Admin: Delete slot ----------------
export const deleteSlot = async (req, res) => {
  try {
    const { id } = req.params;
    const slot = await Slot.findByIdAndDelete(id);
    if (!slot) return res.status(404).json({ success: false, message: "Slot not found" });
    res.json({ success: true, message: "Slot deleted successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
};
