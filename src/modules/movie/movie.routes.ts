import { Router } from "express";
import * as controller from "./movie.controller";
import { createMovieSchema, movieIdSchema } from "./movie.validator";
import { validate } from "../../middleware/validate.middleware";
import { requireAuth } from "../../middleware/auth.middleware";
import { movieUpload } from "../../middleware/upload.middleware";

const router = Router();

router.use(requireAuth);

router.get("/", controller.listMine);
router.post("/", movieUpload, validate(createMovieSchema), controller.create);
router.get("/:movieId", validate(movieIdSchema), controller.getOne);
router.delete("/:movieId", validate(movieIdSchema), controller.remove);

export default router;
