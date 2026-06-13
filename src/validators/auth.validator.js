/**
 * Validates signup details.
 */
const validateRegister = (req, res, next) => {
  const { name, phone, email, password, location, role } = req.body;
  
  if (!name || !phone || !email || !password || !location || !location.coordinates) {
    return res.status(400).json({
      success: false,
      message: 'Please provide all required fields: name, phone, email, password, location (with coordinates [lon, lat]).'
    });
  }

  if (location.type !== 'Point' || !Array.isArray(location.coordinates) || location.coordinates.length !== 2) {
    return res.status(400).json({
      success: false,
      message: 'Location must be a valid GeoJSON Point structure: { type: "Point", coordinates: [lon, lat] }.'
    });
  }

  if (role === 'provider') {
    const { serviceType, capacity, costPerTrip } = req.body;
    if (!serviceType || capacity === undefined || costPerTrip === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Service providers must specify serviceType, capacity, and costPerTrip.'
      });
    }
  }

  next();
};

/**
 * Validates login details.
 */
const validateLogin = (req, res, next) => {
  const { email, password } = req.body;
  
  if (!email || !password) {
    return res.status(400).json({
      success: false,
      message: 'Please provide both email and password.'
    });
  }

  next();
};

module.exports = { validateRegister, validateLogin };
