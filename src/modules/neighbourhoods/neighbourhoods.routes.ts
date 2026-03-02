import { Router } from 'express';
import * as NeighbourhoodController from './neighbourhoods.controller';

const router = Router();

router.route('/').get(NeighbourhoodController.getNeighbourhoods);

export default router;
