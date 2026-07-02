"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("movies", {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.literal("gen_random_uuid()"),
        primaryKey: true,
        allowNull: false,
      },
      title: { type: Sequelize.STRING(200), allowNull: false },
      description: { type: Sequelize.STRING(1000), allowNull: true },
      source: {
        type: Sequelize.ENUM("UPLOAD", "URL"),
        allowNull: false,
        defaultValue: "UPLOAD",
      },
      file_url: { type: Sequelize.STRING(2048), allowNull: false },
      thumbnail_url: { type: Sequelize.STRING(2048), allowNull: true },
      subtitle_url: { type: Sequelize.STRING(2048), allowNull: true },
      mime_type: { type: Sequelize.STRING(100), allowNull: true },
      size_bytes: { type: Sequelize.BIGINT, allowNull: true },
      duration_sec: { type: Sequelize.FLOAT, allowNull: true },
      uploader_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: "users", key: "id" },
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
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

    await queryInterface.addIndex("movies", ["uploader_id"], { name: "movies_uploader_id" });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("movies");
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_movies_source";');
  },
};
