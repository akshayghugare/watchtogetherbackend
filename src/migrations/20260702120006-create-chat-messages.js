"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("chat_messages", {
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
      sender_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: "users", key: "id" },
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      },
      type: {
        type: Sequelize.ENUM("TEXT", "IMAGE", "VIDEO", "FILE", "VOICE_NOTE", "GIF", "SYSTEM"),
        allowNull: false,
        defaultValue: "TEXT",
      },
      content: { type: Sequelize.TEXT, allowNull: true },
      file_url: { type: Sequelize.STRING(2048), allowNull: true },
      file_name: { type: Sequelize.STRING(255), allowNull: true },
      file_size: { type: Sequelize.INTEGER, allowNull: true },
      reply_to_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: "chat_messages", key: "id" },
        onDelete: "SET NULL",
        onUpdate: "CASCADE",
      },
      is_edited: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      is_deleted: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      is_pinned: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
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

    await queryInterface.addIndex("chat_messages", ["room_id", "created_at"], {
      name: "chat_messages_room_id_created_at",
    });
    await queryInterface.addIndex("chat_messages", ["sender_id"], {
      name: "chat_messages_sender_id",
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("chat_messages");
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_chat_messages_type";');
  },
};
