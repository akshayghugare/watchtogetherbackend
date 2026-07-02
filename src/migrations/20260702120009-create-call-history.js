"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("call_history", {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.literal("gen_random_uuid()"),
        primaryKey: true,
        allowNull: false,
      },
      room_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: "rooms", key: "id" },
        onDelete: "SET NULL",
        onUpdate: "CASCADE",
      },
      initiator_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: "users", key: "id" },
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      },
      type: { type: Sequelize.ENUM("AUDIO", "VIDEO"), allowNull: false },
      status: {
        type: Sequelize.ENUM("ONGOING", "ENDED"),
        allowNull: false,
        defaultValue: "ONGOING",
      },
      participant_count: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 1 },
      ended_at: { type: Sequelize.DATE, allowNull: true },
      duration_sec: { type: Sequelize.INTEGER, allowNull: true },
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

    await queryInterface.addIndex("call_history", ["initiator_id"], {
      name: "call_history_initiator_id",
    });
    await queryInterface.addIndex("call_history", ["room_id"], { name: "call_history_room_id" });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("call_history");
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_call_history_type";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_call_history_status";');
  },
};
