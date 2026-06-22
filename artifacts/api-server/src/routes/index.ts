import { Router, type IRouter } from "express";
import healthRouter from "./health";
import templatesRouter from "./templates";
import parseQuoteRouter from "./parse-quote";
import applyVoiceCommandRouter from "./apply-voice-command";

const router: IRouter = Router();

router.use(healthRouter);
router.use(templatesRouter);
router.use(parseQuoteRouter);
router.use(applyVoiceCommandRouter);

export default router;
