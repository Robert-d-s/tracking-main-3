import { Injectable } from '@nestjs/common';
import { PrismaClient, Time } from '@prisma/client';

const prisma = new PrismaClient();

@Injectable()
export class TimeService {
  all(projectId: string): Promise<Time[]> {
    return prisma.time.findMany({
      where: {
        projectId,
      },
    });
  }

  async isDuplicate(
    startTime: Date,
    // endTime: Date,
    userId: number,
    projectId: string,
    rateId: number,
  ): Promise<boolean> {
    const existingEntry = await prisma.time.findFirst({
      where: {
        startTime,
        // endTime,
        userId,
        projectId,
        rateId,
      },
    });
    return !!existingEntry;
  }

  async findExistingEntry(
    startTime: Date,
    userId: number,
    projectId: string,
    rateId: number,
  ): Promise<Time | null> {
    return prisma.time.findFirst({
      where: {
        startTime,
        userId,
        projectId,
        rateId,
      },
    });
  }

  async create(
    startTime: Date,
    projectId: string,
    userId: number,
    rateId: number,
    endTime: Date,
    totalElapsedTime: number, // This is passed directly and should not be calculated here.
  ): Promise<Time> {
    console.log('Backend Service - Creating with Start Time:', startTime);
    console.log('Backend Service - Creating with End Time:', endTime);
    // Check for duplicates
    const duplicate = await this.isDuplicate(
      startTime,
      userId,
      projectId,
      rateId,
    );

    if (duplicate) {
      throw new Error('Duplicate time entry not allowed');
    }

    return prisma.time.create({
      data: {
        startTime,
        endTime, // endTime is now the actual time of submission
        projectId,
        userId,
        rateId,
        totalElapsedTime, // totalElapsedTime is the total active working time
      },
    });
  }

  update(
    id: number,
    endTime: Date,
    totalElapsedTime: number, // Directly use the provided totalElapsedTime
  ): Promise<Time> {
    return prisma.time.update({
      where: { id },
      data: {
        endTime, // Set the endTime to the time of submission
        totalElapsedTime, // Use the provided totalElapsedTime
      },
    });
  }

  remove(id: number): Promise<Time> {
    return prisma.time.delete({
      where: {
        id,
      },
    });
  }

  async getTotalTimeSpent(
    userId: number,
    projectId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<number> {
    console.log(
      `getTotalTimeSpent called with userId: ${userId}, projectId: ${projectId}, startDate: ${startDate.toISOString()}, endDate: ${endDate.toISOString()}`,
    );

    // Adjust startDate to the start of the day
    const adjustedStartDate = new Date(startDate);
    adjustedStartDate.setHours(0, 0, 0, 0);

    // Adjust endDate to include the entire day
    const adjustedEndDate = new Date(endDate);
    adjustedEndDate.setHours(23, 59, 59, 999);

    console.log('Executing database query to aggregate total time spent...');

    try {
      const aggregatedTime = await prisma.time.aggregate({
        where: {
          userId,
          projectId,
          AND: [
            {
              startTime: {
                gte: adjustedStartDate,
              },
            },
            {
              endTime: {
                lte: adjustedEndDate,
              },
            },
          ],
        },
        _sum: {
          totalElapsedTime: true,
        },
      });

      const totalTime = aggregatedTime._sum.totalElapsedTime || 0;
      console.log(`Total time spent for the given period: ${totalTime}`);
      return totalTime;
    } catch (error) {
      console.error('Error in getTotalTimeSpent:', error);
      throw error; // Re-throw the error after logging it
    }
  }

  async getTotalTimeForUserProject(
    userId: number,
    projectId: string,
  ): Promise<number> {
    const aggregatedTime = await prisma.time.aggregate({
      where: {
        userId,
        projectId,
      },
      _sum: {
        totalElapsedTime: true,
      },
    });

    return aggregatedTime._sum.totalElapsedTime || 0;
  }
}
