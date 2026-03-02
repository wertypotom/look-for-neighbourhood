import { Router } from 'express';
import * as NeighbourhoodController from './neighbourhoods.controller';

const router = Router();

router.route('/').get(NeighbourhoodController.getNeighbourhoods);
router.route('/:zip').get(NeighbourhoodController.getReport);

export default router;
