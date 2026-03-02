import { Request, Response, NextFunction } from 'express';
import * as NeighbourhoodService from './neighbourhoods.service';

export const getNeighbourhoods = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const neighbourhoods = await NeighbourhoodService.getAllNeighbourhoods();
    res.status(200).json({
      status: 'success',
      data: {
        neighbourhoods,
      },
    });
  } catch (error) {
    next(error);
  }
};
