"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("rooms", {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.literal("gen_random_uuid()"),
        primaryKey: true,
        allowNull: false,
      },
      name: { type: Sequelize.STRING(100), allowNull: false },
      code: { type: Sequelize.STRING(12), allowNull: false, unique: true },
      privacy: {
        type: Sequelize.ENUM("PUBLIC", "PRIVATE"),
        allowNull: false,
        defaultValue: "PUBLIC",
      },
      password_hash: { type: Sequelize.STRING, allowNull: true },
      host_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: "users", key: "id" },
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      },
      movie_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: "movies", key: "id" },
        onDelete: "SET NULL",
        onUpdate: "CASCADE",
      },
      is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      max_members: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 25 },
      playback_position_sec: { type: Sequelize.FLOAT, allowNull: false, defaultValue: 0 },
      is_playing: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      playback_rate: { type: Sequelize.FLOAT, allowNull: false, defaultValue: 1 },
      playback_updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
      ended_at: { type: Sequelize.DATE, allowNull: true },
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

    await queryInterface.addIndex("rooms", ["host_id"], { name: "rooms_host_id" });
    await queryInterface.addIndex("rooms", ["privacy", "is_active"], {
      name: "rooms_privacy_is_active",
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("rooms");
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_rooms_privacy";');
  },
};
