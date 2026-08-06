import type { Request, Response } from "express";


export const getHealth = (req: Request, res: Response) => {
    return res.status(200).json({
        status: "OK",
        message: "System is running properly.",
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
    })
}