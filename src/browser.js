import JSZip from 'jszip';
import * as path from 'path-browserify';

import {
	getHtmlRawString,
	isValidEpubNaming,
	isValidFilename,
	isValidMwbSched,
	parseEpub,
} from './common';

const loadEPUB = async (epubInput) => {
	const appZip = new JSZip();

	const validMwbFiles = [];
	let mwbYear;

	const initEpub = async (zip) => {
		const MAX_FILES = 300;
		const MAX_SIZE = 20000000; // 20 MO

		let fileCount = 0;
		let totalSize = 0;
		let targetDirectory = 'archive_tmp';

		for (let [filename, file] of Object.entries(zip.files)) {
			fileCount++;
			if (fileCount > MAX_FILES) {
				while (validMwbFiles.length > 0) {
					validMwbFiles.pop();
				}
				throw new Error('Reached max. number of files');
			}

			// Prevent ZipSlip path traversal (S6096)
			const resolvedPath = path.join(targetDirectory, filename);
			if (!resolvedPath.startsWith(targetDirectory)) {
				while (validMwbFiles.length > 0) {
					validMwbFiles.pop();
				}
				throw new Error('Path traversal detected');
			}

			const contentSize = await appZip.file(filename).async('ArrayBuffer');
			totalSize += contentSize.byteLength;
			if (totalSize > MAX_SIZE) {
				while (validMwbFiles.length > 0) {
					validMwbFiles.pop();
				}
				throw new Error('Reached max. size');
			}

			if (isValidFilename(filename)) {
				const content = await getHtmlRawString(zip, filename);

				const parser = new window.DOMParser();
				const htmlDoc = parser.parseFromString(content, 'text/html');

				if (isValidMwbSched(htmlDoc)) {
					validMwbFiles.push(htmlDoc);
				}
			}
		}
	};

	// check if we receive path or blob
	let data;
	if (epubInput.name) {
		if (isValidEpubNaming(epubInput.name)) {
			mwbYear = epubInput.name.split('_')[2].substring(0, 4);
			data = epubInput; // blob
		} else {
			throw new Error('The selected epub file has an incorrect naming.');
		}
	} else {
		throw new Error(
			'You are using the browser version of the module. Please switch to the node version if needed'
		);
	}

	const doParsing = () => {
		return new Promise((resolve, reject) => {
			appZip.loadAsync(data).then(async (zip) => {
				await initEpub(zip);

				if (validMwbFiles.length === 0) {
					reject(
						'The file you provided is not a valid Meeting Workbook EPUB file. Please make sure that the file is correct.'
					);
				} else {
					resolve(parseEpub(validMwbFiles, mwbYear));
				}
			});
		});
	};

	const result = await doParsing();
	return result;
};

export { loadEPUB };
