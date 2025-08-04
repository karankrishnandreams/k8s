import kongAxios, { CustomAxiosRequestConfig } from "@services/kong.service";
import { Request, Response, NextFunction } from "express";

export const getUserData = async (req: Request) => {
    try {
        const token: any = req.headers["authorization"];
        const origin: any = req.headers["origin"] || req.headers["referer"];
        //@ts-ignore
        const userId = req.user.id;

        const configUser: CustomAxiosRequestConfig = {
            method: "get",
            url: `/user/company/user/detail/${userId}`,
            token,
            headers: {
                Origin: origin,
            },
        };

        return await kongAxios(configUser);
    } catch (error) {
        console.log('errr oooooooooooooooooooooooo', error)
    }
}