"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("friend_requests", {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.literal("gen_random_uuid()"),
        primaryKey: true,
        allowNull: false,
      },
      sender_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: "users", key: "id" },
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      },
      receiver_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: "users", key: "id" },
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      },
      status: {
        type: Sequelize.ENUM("PENDING", "ACCEPTED", "REJECTED", "CANCELLED"),
        allowNull: false,
        defaultValue: "PENDING",
      },
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

    await queryInterface.addIndex("friend_requests", ["receiver_id", "status"], {
      name: "friend_requests_receiver_id_status",
    });
    await queryInterface.addIndex("friend_requests", ["sender_id", "receiver_id"], {
      name: "friend_requests_sender_id_receiver_id",
      unique: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("friend_requests");
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_friend_requests_status";');
  },
};
