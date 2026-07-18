import { Router, type IRouter } from "express";
import healthRouter from "./health";
import templatesRouter from "./templates";
import parseQuoteRouter from "./parse-quote";
import applyVoiceCommandRouter from "./apply-voice-command";
import profileRouter from "./profile";
import quotesRouter from "./quotes";
import emailTemplatesRouter from "./email-templates";
import emailRecordsRouter from "./email-records";
import sendQuoteEmailRouter from "./send-quote-email";
import adminRouter from "./admin";
import billingRouter from "./billing";

const router: IRouter = Router();

router.use(healthRouter);
router.use(templatesRouter);
router.use(parseQuoteRouter);
router.use(applyVoiceCommandRouter);
router.use(profileRouter);
router.use(quotesRouter);
router.use(emailTemplatesRouter);
router.use(emailRecordsRouter);
router.use(sendQuoteEmailRouter);
router.use(adminRouter);
router.use(billingRouter);

export default router;
