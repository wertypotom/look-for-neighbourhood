import { Request, Response, NextFunction } from 'express';
import {
  getNeighbourhoodReport,
  getAllNeighbourhoods,
} from './neighbourhoods.service';
import { z } from 'zod';

const zipSchema = z
  .string()
  .regex(/^\d{5}$/, 'Must be a valid 5-digit US ZIP code');

export const getNeighbourhoods = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const neighbourhoods = await getAllNeighbourhoods();
    res.status(200).json({
      status: 'success',
      data: neighbourhoods,
    });
  } catch (err) {
    next(err);
  }
};

export const getReport = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { zip } = req.params;

    // Validate ZIP
    const parsedZip = zipSchema.safeParse(zip);
    if (!parsedZip.success) {
      res.status(400).json({
        status: 'fail',
        message: parsedZip.error.issues[0].message,
      });
      return;
    }

    // Call service layer pipeline
    const report = await getNeighbourhoodReport(parsedZip.data);

    res.status(200).json({
      status: 'success',
      data: report,
    });
  } catch (err) {
    next(err);
  }
};
