/**
 * Validates request creation parameters.
 */
const validateCreateRequest = (req, res, next) => {
  const { serviceType, quantity, requestedDate, requestedTime, location } = req.body;

  if (!serviceType || quantity === undefined || !requestedDate || !requestedTime || !location) {
    return res.status(400).json({
      success: false,
      message: 'Please provide all request fields: serviceType, quantity, requestedDate, requestedTime, location.'
    });
  }

  if (location.type !== 'Point' || !Array.isArray(location.coordinates) || location.coordinates.length !== 2) {
    return res.status(400).json({
      success: false,
      message: 'Location must be a GeoJSON Point: { type: "Point", coordinates: [longitude, latitude] }.'
    });
  }

  next();
};

module.exports = { validateCreateRequest };
