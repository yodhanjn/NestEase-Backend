const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const {
  createPG, uploadPGImages, getAllPGs, getPGById, updatePG, deletePG, getMyPGs,
} = require('../controllers/pgController');
const { protect, restrictTo } = require('../middleware/auth');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) cb(null, true);
    else cb(new Error('Only image files are allowed'));
  },
});

router.get('/', getAllPGs);
router.get('/my', protect, restrictTo('owner'), getMyPGs);
router.get('/:id', getPGById);
router.post('/', protect, restrictTo('owner'), createPG);
router.post('/:id/images', protect, restrictTo('owner'), upload.array('images', 10), uploadPGImages);
router.put('/:id', protect, restrictTo('owner', 'admin'), updatePG);
router.delete('/:id', protect, restrictTo('owner', 'admin'), deletePG);

module.exports = router;
