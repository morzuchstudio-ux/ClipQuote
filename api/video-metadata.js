import handler from "../server/video-metadata.js";
import { nodeHandler } from "../server/adapter.js";
export default nodeHandler(handler);
