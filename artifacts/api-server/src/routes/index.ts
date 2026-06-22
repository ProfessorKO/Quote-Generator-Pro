import { Router, type IRouter } from "express";
import healthRouter from "./health";
import templatesRouter from "./templates";
import parseQuoteRouter from "./parse-quote";

const router: IRouter = Router();

router.use(healthRouter);
router.use(templatesRouter);
router.use(parseQuoteRouter);

export default router;
