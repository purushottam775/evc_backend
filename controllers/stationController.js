import ChargingStation from "../models/ChargingStation.js";
import Slot from "../models/Slot.js";

const validChargingTypes = ["fast", "slow"];
const validStationStatus = ["active", "inactive"];

// ---------------- Admin: Add new station ----------------
export const addStation = async (req, res) => {
  try {
    const { station_name, location, total_slots, charging_type, station_status } = req.body;

    // 1. Required fields
    if (!station_name || !location || !total_slots || !charging_type || !station_status) {
      return res.status(400).json({ message: "All fields are required" });
    }

    // 2. Validate charging_type and station_status
    if (!validChargingTypes.includes(charging_type)) {
      return res.status(400).json({ message: "Invalid charging type" });
    }
    if (!validStationStatus.includes(station_status)) {
      return res.status(400).json({ message: "Invalid station status" });
    }

    // 3. Validate total_slots
    if (total_slots <= 0 || !Number.isInteger(total_slots)) {
      return res.status(400).json({ message: "Total slots must be a positive integer" });
    }

    // 4. Check uniqueness of station_name
    const existingStation = await ChargingStation.findOne({ station_name });
    if (existingStation) return res.status(400).json({ message: "Station name already exists" });

    // 5. Create station
    const station = await ChargingStation.create({
      station_name,
      location,
      total_slots,
      available_slots: total_slots,
      charging_type,
      station_status,
    });

    // 6. Auto-create slots
    const slots = Array.from({ length: total_slots }, (_, i) => ({
      station_id: station._id,
      slot_number: i + 1,
      slot_status: "available",
    }));
    await Slot.insertMany(slots);

    res.status(201).json({ message: "Station and slots created successfully", station_id: station._id });
  } catch (err) {
    console.error(err);
    if (err.code === 11000) return res.status(400).json({ message: "Station name already exists" });
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// ---------------- Admin: Update station ----------------
export const updateStation = async (req, res) => {
  try {
    const { id } = req.params;
    const { station_name, location, total_slots, charging_type, station_status } = req.body;

    const station = await ChargingStation.findById(id);
    if (!station) return res.status(404).json({ message: "Station not found" });

    // Validate charging_type and station_status
    if (charging_type && !validChargingTypes.includes(charging_type)) {
      return res.status(400).json({ message: "Invalid charging type" });
    }
    if (station_status && !validStationStatus.includes(station_status)) {
      return res.status(400).json({ message: "Invalid station status" });
    }

    // Check uniqueness of new station_name
    if (station_name && station_name !== station.station_name) {
      const existingStation = await ChargingStation.findOne({ station_name });
      if (existingStation) return res.status(400).json({ message: "Station name already exists" });
      station.station_name = station_name;
    }

    // Validate total_slots
    if (total_slots !== undefined) {
      if (total_slots <= 0 || !Number.isInteger(total_slots)) {
        return res.status(400).json({ message: "Total slots must be a positive integer" });
      }

      const bookedSlotsCount = await Slot.countDocuments({
        station_id: id,
        slot_status: { $ne: "available" },
      });

      if (total_slots < bookedSlotsCount) {
        return res.status(400).json({ message: "Cannot reduce total slots below booked slots" });
      }

      const addedSlots = total_slots - station.total_slots;
      station.total_slots = total_slots;
      station.available_slots += addedSlots;

      if (addedSlots > 0) {
        const existingSlots = await Slot.find({ station_id: id }).select("slot_number");
        const existingNumbers = existingSlots.map(s => s.slot_number);

        const newSlots = [];
        for (let i = 1; i <= total_slots; i++) {
          if (!existingNumbers.includes(i)) {
            newSlots.push({ station_id: id, slot_number: i, slot_status: "available" });
          }
        }
        if (newSlots.length > 0) await Slot.insertMany(newSlots);
      } else if (addedSlots < 0) {
        // Remove only available slots
        const removableSlots = await Slot.find({ station_id: id, slot_status: "available" })
          .sort({ slot_number: -1 })
          .limit(-addedSlots);
        const removableIds = removableSlots.map(s => s._id);
        if (removableIds.length > 0) await Slot.deleteMany({ _id: { $in: removableIds } });
      }
    }

    if (location) station.location = location;
    if (charging_type) station.charging_type = charging_type;
    if (station_status) station.station_status = station_status;

    await station.save();
    res.json({ message: "Station updated successfully" });
  } catch (err) {
    console.error(err);
    if (err.code === 11000) return res.status(400).json({ message: "Station name already exists" });
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// ---------------- Admin: Delete station ----------------
export const deleteStation = async (req, res) => {
  try {
    const { id } = req.params;

    const station = await ChargingStation.findByIdAndDelete(id);
    if (!station) return res.status(404).json({ message: "Station not found" });

    await Slot.deleteMany({ station_id: id });

    res.json({ message: "Station and its slots deleted successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// ---------------- User: List/search stations ----------------
export const listStations = async (req, res) => {
  try {
    const { location, charging_type } = req.query;

    const filter = { station_status: "active" };
    if (location) filter.location = { $regex: location, $options: "i" };
    if (charging_type) {
      if (!validChargingTypes.includes(charging_type)) {
        return res.status(400).json({ message: "Invalid charging type" });
      }
      filter.charging_type = charging_type;
    }

    const stations = await ChargingStation.find(filter);
    res.json({ stations });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};
