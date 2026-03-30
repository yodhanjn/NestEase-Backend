const Booking = require('../models/Booking');
const PGProperty = require('../models/PGProperty');

const getUserRecommendations = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const userRole = req.user.role;

    if (userRole !== 'resident') {
      return res.status(403).json({ success: false, message: 'Recommendations are available for residents only' });
    }

    const bookingHistory = await Booking.find({
      user: userId,
      status: { $in: ['confirmed', 'completed'] },
    }).populate('pg', 'location price amenities genderAllowed');

    const preference = {
      cities: new Set(),
      amenities: new Set(),
      avgBudget: null,
      preferredGender: 'any',
    };

    if (bookingHistory.length) {
      let totalPrice = 0;
      let pricedCount = 0;
      const genderCount = { any: 0, male: 0, female: 0 };

      bookingHistory.forEach((booking) => {
        const pg = booking.pg;
        if (!pg) return;

        if (pg.location?.city) preference.cities.add(String(pg.location.city).toLowerCase());
        (pg.amenities || []).forEach((amenity) => preference.amenities.add(String(amenity)));

        if (typeof pg.price === 'number' && pg.price > 0) {
          totalPrice += pg.price;
          pricedCount += 1;
        }
        if (genderCount[pg.genderAllowed] !== undefined) {
          genderCount[pg.genderAllowed] += 1;
        }
      });

      if (pricedCount > 0) {
        preference.avgBudget = totalPrice / pricedCount;
      }

      preference.preferredGender = Object.entries(genderCount).sort((a, b) => b[1] - a[1])[0][0];
    }

    const allCandidatePGs = await PGProperty.find({
      isActive: true,
      isVerified: true,
    })
      .populate('owner', 'name email phone profileImage')
      .sort({ createdAt: -1 })
      .limit(200);

    const previouslyBookedPgIds = new Set(bookingHistory.map((b) => String(b.pg?._id)).filter(Boolean));

    const scored = allCandidatePGs
      .filter((pg) => !previouslyBookedPgIds.has(String(pg._id)))
      .map((pg) => {
        let score = 0;
        const reasons = [];

        if (pg.overallRating > 0) {
          const ratingScore = Math.min(35, pg.overallRating * 7);
          score += ratingScore;
          reasons.push(`Strong rating (${pg.overallRating.toFixed(1)})`);
        }

        if (preference.cities.size && pg.location?.city) {
          const city = String(pg.location.city).toLowerCase();
          if (preference.cities.has(city)) {
            score += 20;
            reasons.push('In your preferred city');
          }
        }

        if (preference.preferredGender !== 'any') {
          if (pg.genderAllowed === preference.preferredGender || pg.genderAllowed === 'any') {
            score += 10;
            reasons.push('Matches your usual stay preference');
          }
        } else if (pg.genderAllowed === 'any') {
          score += 4;
        }

        if (preference.avgBudget) {
          const variance = Math.abs(pg.price - preference.avgBudget) / preference.avgBudget;
          if (variance <= 0.15) {
            score += 18;
            reasons.push('Within your usual budget');
          } else if (variance <= 0.3) {
            score += 10;
            reasons.push('Near your usual budget');
          } else if (variance <= 0.5) {
            score += 5;
          }
        }

        const pgAmenities = new Set(pg.amenities || []);
        if (preference.amenities.size && pgAmenities.size) {
          let overlap = 0;
          preference.amenities.forEach((amenity) => {
            if (pgAmenities.has(amenity)) overlap += 1;
          });
          if (overlap > 0) {
            const amenityScore = Math.min(17, overlap * 4);
            score += amenityScore;
            reasons.push(`Shares ${overlap} preferred amenit${overlap > 1 ? 'ies' : 'y'}`);
          }
        }

        if (pg.totalReviews >= 5) {
          score += 4;
        }

        return {
          pg,
          recommendationScore: Math.round(Math.min(100, score)),
          reasons: reasons.slice(0, 3),
        };
      })
      .sort((a, b) => b.recommendationScore - a.recommendationScore)
      .slice(0, 12);

    res.status(200).json({
      success: true,
      count: scored.length,
      recommendations: scored,
      preferenceSummary: {
        cities: Array.from(preference.cities),
        averageBudget: preference.avgBudget ? Math.round(preference.avgBudget) : null,
        preferredGender: preference.preferredGender,
      },
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { getUserRecommendations };
