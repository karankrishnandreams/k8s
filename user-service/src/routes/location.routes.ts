import { Router } from "express";
import {
  getLocations,
  getCountriesByPhoneCode,
  getStatesByCountryCode,
  getCountryList,
  getStateList,
  getCityList,
  getCountryFullList,
  getStateFullList,
  getLocationsbyId,
  getCountryNamesByIds,
  getLocationNamesByIds,
  getLocationsByName,
  getCurrency,
} from "../controllers/location.controller";
import { validate } from "@middlewares/validation";
import {
  getCountriesByPhoneCodeValidator,
  getLocationsValidator,
  getStatesByCountryCodeValidator,
  listCityValidationRules,
  listCountryValidationRules,
  listStateValidationRules,
} from "@validations/location.validation";

const router = Router();

// Route to get all locations with advanced filtering
router.get("/", validate(getLocationsValidator), getLocations);

// Route to get countries by phone code
router.get(
  "/countries/phoneCode/:phoneCode",
  validate(getCountriesByPhoneCodeValidator),
  getCountriesByPhoneCode
);

// Route to get states by country code
router.get(
  "/states/countryCode",
  validate(getStatesByCountryCodeValidator),
  getStatesByCountryCode
);

// Route to get all locations country list
router.get("/country", validate(listCountryValidationRules), getCountryList);
router.get("/states", validate(listStateValidationRules), getStateList);
router.get("/cities", validate(listCityValidationRules), getCityList);

router.get(
  "/getlocation/:id",
  validate(getLocationsValidator),
  getLocationsbyId
);

router.get("/country/list", getCountryFullList);
router.get("/state/list/:id", getStateFullList);
router.get("/city/list/:id", getCityList);
router.post("/country/name", getCountryNamesByIds);
router.post('/names/by-ids',getLocationNamesByIds);
router.get('/currency',getCurrency);
router.get('/locations/get-ids',getLocationsByName);
export default router;
