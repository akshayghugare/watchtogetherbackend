"use strict";

/**
 * Uploaded movie files (plus thumbnails and subtitles) now live in the
 * database itself instead of the local uploads/movies folder.
 *
 * @type {import('sequelize-cli').Migration}
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("movies", "file_data", {
      type: Sequelize.BLOB,
      allowNull: true,
    });
    await queryInterface.addColumn("movies", "thumbnail_data", {
      type: Sequelize.BLOB,
      allowNull: true,
    });
    await queryInterface.addColumn("movies", "thumbnail_mime", {
      type: Sequelize.STRING(100),
      allowNull: true,
    });
    await queryInterface.addColumn("movies", "subtitle_data", {
      type: Sequelize.BLOB,
      allowNull: true,
    });
    await queryInterface.addColumn("movies", "subtitle_mime", {
      type: Sequelize.STRING(100),
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn("movies", "file_data");
    await queryInterface.removeColumn("movies", "thumbnail_data");
    await queryInterface.removeColumn("movies", "thumbnail_mime");
    await queryInterface.removeColumn("movies", "subtitle_data");
    await queryInterface.removeColumn("movies", "subtitle_mime");
  },
};
