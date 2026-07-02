import type { Request, Response } from "express";
import * as movieService from "./movie.service";
import { sendResponse } from "../../utils/ApiResponse";
import { asyncHandler } from "../../utils/asyncHandler";
import { HTTP_STATUS } from "../../constants";

export const create = asyncHandler(async (req: Request, res: Response) => {
  const movie = await movieService.createMovie(req.user!.id, {
    title: req.body.title,
    description: req.body.description || undefined,
    url: req.body.url || undefined,
    files: req.files as never,
  });
  sendResponse(res, HTTP_STATUS.CREATED, "Movie added.", { movie });
});

export const listMine = asyncHandler(async (req: Request, res: Response) => {
  const movies = await movieService.listMyMovies(req.user!.id);
  sendResponse(res, HTTP_STATUS.OK, "OK", { movies });
});

export const getOne = asyncHandler(async (req: Request, res: Response) => {
  const movie = await movieService.getMovie(req.params.movieId);
  sendResponse(res, HTTP_STATUS.OK, "OK", { movie });
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  await movieService.deleteMovie(req.user!.id, req.params.movieId);
  sendResponse(res, HTTP_STATUS.OK, "Movie deleted.");
});
