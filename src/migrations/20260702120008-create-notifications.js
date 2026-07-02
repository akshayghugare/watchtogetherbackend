"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("notifications", {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.literal("gen_random_uuid()"),
        primaryKey: true,
        allowNull: false,
      },
      recipient_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: "users", key: "id" },
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      },
      actor_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: "users", key: "id" },
        onDelete: "SET NULL",
        onUpdate: "CASCADE",
      },
      type: {
        type: Sequelize.ENUM(
          "FRIEND_REQUEST",
          "FRIEND_ACCEPTED",
          "MOVIE_STARTED",
          "MOVIE_INVITATION",
          "INCOMING_CALL",
          "NEW_MESSAGE",
          "ROOM_INVITE",
          "MEMBER_JOINED",
          "HOST_TRANSFERRED",
          "SYSTEM"
        ),
        allowNull: false,
      },
      title: { type: Sequelize.STRING(150), allowNull: false },
      body: { type: Sequelize.STRING(500), allowNull: true },
      image_url: { type: Sequelize.STRING, allowNull: true },
      data: { type: Sequelize.JSONB, allowNull: true },
      is_read: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
    });

    await queryInterface.addIndex("notifications", ["recipient_id", "is_read", "created_at"], {
      name: "notifications_recipient_id_is_read_created_at",
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("notifications");
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_notifications_type";');
  },
};
