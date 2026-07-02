"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("video_progress", {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.literal("gen_random_uuid()"),
        primaryKey: true,
        allowNull: false,
      },
      user_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: "users", key: "id" },
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      },
      room_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: "rooms", key: "id" },
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      },
      position_sec: { type: Sequelize.FLOAT, allowNull: false, defaultValue: 0 },
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

    await queryInterface.addIndex("video_progress", ["user_id", "room_id"], {
      name: "video_progress_user_id_room_id",
      unique: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("video_progress");
  },
};
