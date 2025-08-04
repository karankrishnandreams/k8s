import { createWarehouse, deleteWarehouse, exportWarehouse, warHouseById, getWarehouseById, sampleWarehouseImport, listWarehouses,getUserExistInWarehouse ,updateWarehouse, updateWarehouseStatus,importWarehouse, warehouseSearch, warehouseNames } from '@controllers/warehouse.controller';
import { authenticateWithSubdomainCheck } from '@middlewares/authentication';
import { validate } from '@middlewares/validate';
import { Router } from 'express';
import { createWarehouseValidation, updateWarehouseValidation } from '../validations.ts/warehouse.validation';
import { RoleKeys } from '@utils/constants/roleKeys';
import multer from 'multer';

const router = Router();

const upload = multer({ storage: multer.memoryStorage() }); // in-memory sto


router.get("/sample-import", authenticateWithSubdomainCheck(true,RoleKeys.WAREHOUSE),sampleWarehouseImport);
router.post('/import',authenticateWithSubdomainCheck(true), upload.single('file'), importWarehouse)

router.post('/create', authenticateWithSubdomainCheck(true, RoleKeys.WAREHOUSE), validate(createWarehouseValidation), createWarehouse)
router.get('/list', authenticateWithSubdomainCheck(true, RoleKeys.WAREHOUSE), listWarehouses)
router.get('/view/:id', authenticateWithSubdomainCheck(true, RoleKeys.WAREHOUSE), getWarehouseById)
router.put('/update/:id', authenticateWithSubdomainCheck(true, RoleKeys.WAREHOUSE), validate(updateWarehouseValidation), updateWarehouse)
router.delete('/delete/:id', authenticateWithSubdomainCheck(true, RoleKeys.WAREHOUSE), deleteWarehouse)
router.get('/:export',authenticateWithSubdomainCheck(true, ), exportWarehouse)
router.get('/user/exist/:id', authenticateWithSubdomainCheck(true, RoleKeys.WAREHOUSE), getUserExistInWarehouse);
router.put('/status/:id',authenticateWithSubdomainCheck(true, RoleKeys.WAREHOUSE),updateWarehouseStatus)
router.get('/warehouse/:id', warHouseById)
router.get('/warehouse/search/:name', authenticateWithSubdomainCheck(true, RoleKeys.WAREHOUSE),warehouseSearch);
router.post('/name', authenticateWithSubdomainCheck(true, RoleKeys.WAREHOUSE), warehouseNames);

export default router;

