import { createManufacturer, deleteManufacturer, exportManufacturers, getManufacturerById, listManufacturers,sampleManufacturersImport, importManufacturers, updateManufacturer, updateManufacturerStatus } from '@controllers/manufacturer.controller';
import { authenticateWithSubdomainCheck } from '@middlewares/authentication';
import { validate } from '@middlewares/validate';
import { Router } from 'express';
import { createManufacturerValidator, updateManufacturerValidator } from '@validations/manufacturer.validation';
import { RoleKeys } from '../utils/constants/roleKeys';
import multer from 'multer';

const router = Router();

const upload = multer({ storage: multer.memoryStorage() }); // in-memory sto


router.post('/import',authenticateWithSubdomainCheck(true,RoleKeys.MANUFACTURER), upload.single('file'), importManufacturers);
router.get("/sample/import", authenticateWithSubdomainCheck(true,RoleKeys.MANUFACTURER),sampleManufacturersImport);

router.post('/create',authenticateWithSubdomainCheck(true, RoleKeys.MANUFACTURER),validate(createManufacturerValidator),createManufacturer)
router.get('/list',authenticateWithSubdomainCheck(true, RoleKeys.MANUFACTURER),listManufacturers)
router.get('/view/:id',authenticateWithSubdomainCheck(true, RoleKeys.MANUFACTURER),getManufacturerById),
router.put('/update/:id',authenticateWithSubdomainCheck(true, RoleKeys.MANUFACTURER),validate(updateManufacturerValidator),updateManufacturer)
router.put('/status/:id',authenticateWithSubdomainCheck(true, RoleKeys.MANUFACTURER),updateManufacturerStatus)
router.delete('/delete/:id',authenticateWithSubdomainCheck(true, RoleKeys.MANUFACTURER),deleteManufacturer)
router.get('/:export',authenticateWithSubdomainCheck(true),exportManufacturers)
export default router;