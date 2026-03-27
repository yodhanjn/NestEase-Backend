const PGProperty = require('../models/PGProperty');
const cloudinary = require('../config/cloudinary');

const createPG = async (req, res, next) => {
  try {
    const { pgName, description, address, city, state, pincode, lat, lng, price, genderAllowed, availableRooms, amenities } = req.body;

    const pg = await PGProperty.create({
      owner: req.user._id,
      pgName,
      description,
      location: { address, city, state, pincode, lat: lat ? Number(lat) : undefined, lng: lng ? Number(lng) : undefined },
      price: Number(price),
      genderAllowed,
      availableRooms: Number(availableRooms) || 0,
      amenities: amenities ? (Array.isArray(amenities) ? amenities : amenities.split(',').map((a) => a.trim())) : [],
    });

    res.status(201).json({ success: true, message: 'PG listing created successfully', pg });
  } catch (err) {
    next(err);
  }
};

const uploadPGImages = async (req, res, next) => {
  try {
    const pg = await PGProperty.findById(req.params.id);
    if (!pg) return res.status(404).json({ success: false, message: 'PG not found' });

    if (pg.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, message: 'No images uploaded' });
    }

    const uploadPromises = req.files.map((file) =>
      cloudinary.uploader.upload(file.path, { folder: 'nestease/pg_images' })
    );
    const results = await Promise.all(uploadPromises);
    const imageUrls = results.map((r) => r.secure_url);

    pg.images.push(...imageUrls);
    await pg.save();

    res.status(200).json({ success: true, images: pg.images });
  } catch (err) {
    next(err);
  }
};

const getAllPGs = async (req, res, next) => {
  try {
    const { city, minPrice, maxPrice, gender, amenities, rating, sort, page = 1, limit = 12 } = req.query;

    const query = { isActive: true, isVerified: true };

    if (city) query['location.city'] = { $regex: city, $options: 'i' };
    if (gender && gender !== 'any') query.genderAllowed = { $in: [gender, 'any'] };
    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) query.price.$gte = Number(minPrice);
      if (maxPrice) query.price.$lte = Number(maxPrice);
    }
    if (rating) query.overallRating = { $gte: Number(rating) };
    if (amenities) {
      const amenityList = amenities.split(',').map((a) => a.trim());
      query.amenities = { $all: amenityList };
    }

    let sortOption = { createdAt: -1 };
    if (sort === 'price_asc') sortOption = { price: 1 };
    else if (sort === 'price_desc') sortOption = { price: -1 };
    else if (sort === 'rating') sortOption = { overallRating: -1 };

    const skip = (Number(page) - 1) * Number(limit);
    const total = await PGProperty.countDocuments(query);
    const pgs = await PGProperty.find(query)
      .populate('owner', 'name email phone profileImage')
      .sort(sortOption)
      .skip(skip)
      .limit(Number(limit));

    res.status(200).json({
      success: true,
      total,
      page: Number(page),
      pages: Math.ceil(total / Number(limit)),
      pgs,
    });
  } catch (err) {
    next(err);
  }
};

const getPGById = async (req, res, next) => {
  try {
    const pg = await PGProperty.findById(req.params.id).populate('owner', 'name email phone profileImage');
    if (!pg) return res.status(404).json({ success: false, message: 'PG not found' });
    res.status(200).json({ success: true, pg });
  } catch (err) {
    next(err);
  }
};

const updatePG = async (req, res, next) => {
  try {
    const pg = await PGProperty.findById(req.params.id);
    if (!pg) return res.status(404).json({ success: false, message: 'PG not found' });

    if (pg.owner.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    const { pgName, description, address, city, state, pincode, lat, lng, price, genderAllowed, availableRooms, amenities } = req.body;

    if (pgName) pg.pgName = pgName;
    if (description) pg.description = description;
    if (address) pg.location.address = address;
    if (city) pg.location.city = city;
    if (state) pg.location.state = state;
    if (pincode) pg.location.pincode = pincode;
    if (lat) pg.location.lat = Number(lat);
    if (lng) pg.location.lng = Number(lng);
    if (price) pg.price = Number(price);
    if (genderAllowed) pg.genderAllowed = genderAllowed;
    if (availableRooms !== undefined) pg.availableRooms = Number(availableRooms);
    if (amenities) pg.amenities = Array.isArray(amenities) ? amenities : amenities.split(',').map((a) => a.trim());

    await pg.save();
    res.status(200).json({ success: true, message: 'PG updated successfully', pg });
  } catch (err) {
    next(err);
  }
};

const deletePG = async (req, res, next) => {
  try {
    const pg = await PGProperty.findById(req.params.id);
    if (!pg) return res.status(404).json({ success: false, message: 'PG not found' });

    if (pg.owner.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    await pg.deleteOne();
    res.status(200).json({ success: true, message: 'PG listing deleted' });
  } catch (err) {
    next(err);
  }
};

const getMyPGs = async (req, res, next) => {
  try {
    const pgs = await PGProperty.find({ owner: req.user._id }).sort({ createdAt: -1 });
    res.status(200).json({ success: true, pgs });
  } catch (err) {
    next(err);
  }
};

module.exports = { createPG, uploadPGImages, getAllPGs, getPGById, updatePG, deletePG, getMyPGs };
