import sequelize from "./config/db";
import "./modules/user/model/user.model"; // import all models here
import "./modules/auth/model/session.model";
import "./modules/friend/model/friend-request.model";
import "./modules/friend/model/friendship.model";
import "./modules/movie/model/movie.model";
import "./modules/room/model/room.model";
import "./modules/room/model/room-member.model";
import "./modules/room/model/room-invite.model";
import "./modules/room/model/video-progress.model";
import "./modules/chat/model/chat-message.model";
import "./modules/chat/model/message-reaction.model";
import "./modules/notification/model/notification.model";
import "./modules/call/model/call-history.model";
import "./modules/call/model/call-participant.model";
import "./modules/admin/model/activity-log.model";

const syncDb = async () => {
  try {
    await sequelize.authenticate();
    console.log("✅ DB connected");

    // alter: true safely updates schema without dropping data
    await sequelize.sync({ alter: true });
    console.log("✅ All models synced");

    process.exit(0);
  } catch (error) {
    console.error("❌ DB sync failed:", error);
    process.exit(1);
  }
};

syncDb();
