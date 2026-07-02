"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("room_members", {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.literal("gen_random_uuid()"),
        primaryKey: true,
        allowNull: false,
      },
      room_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: "rooms", key: "id" },
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      },
      user_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: "users", key: "id" },
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      },
      role: {
        type: Sequelize.ENUM("HOST", "MODERATOR", "MEMBER"),
        allowNull: false,
        defaultValue: "MEMBER",
      },
      is_kicked: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      left_at: { type: Sequelize.DATE, allowNull: true },
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

    await queryInterface.addIndex("room_members", ["room_id", "user_id"], {
      name: "room_members_room_id_user_id",
      unique: true,
    });
    await queryInterface.addIndex("room_members", ["user_id"], { name: "room_members_user_id" });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("room_members");
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_room_members_role";');
  },
};
