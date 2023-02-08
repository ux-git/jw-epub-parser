import fs from 'fs';
import fetch from 'node-fetch';
import { expect } from 'chai';
import { loadEPUB } from '../dist/node/index.js';

const list = JSON.parse(await fs.promises.readFile(new URL('./enhancedParsing/list.json', import.meta.url)));

const JW_CDN = 'https://app.jw-cdn.org/apis/pub-media/GETPUBMEDIALINKS?';
const JW_FINDER = 'https://www.jw.org/finder?';

describe('Live download enhanced parsing', () => {
	for (let i = 0; i < list.length; i++) {
		const { language } = list[i];

		const fetchData = new Promise(async (resolve, reject) => {
			let notFound = false;

			try {
				const mergedSources = [];

				// get current issue
				const today = new Date();
				const day = today.getDay();
				const diff = today.getDate() - day + (day === 0 ? -6 : 1);
				const weekDate = new Date(today.setDate(diff));
				const currentMonth = weekDate.getMonth() + 1;
				const monthOdd = currentMonth % 2 === 0 ? false : true;
				let monthMwb = monthOdd ? currentMonth : currentMonth - 1;
				let currentYear = weekDate.getFullYear();

				do {
					const issueDate = currentYear + String(monthMwb).padStart(2, '0');
					const url =
						JW_CDN +
						new URLSearchParams({
							langwritten: language,
							pub: 'mwb',
							output: 'json',
							issue: issueDate,
						});

					const res = await fetch(url);

					if (res.status === 404) {
						notFound = true;
					} else {
						const result = await res.json();
						const hasEPUB = result.files[language].EPUB;

						if (hasEPUB) {
							const epubFile = hasEPUB[0].file;
							const epubUrl = epubFile.url;
							const epubModifiedDate = epubFile.modifiedDatetime;

							const epubData = await loadEPUB({ url: epubUrl });
							const obj = {
								issueDate,
								modifiedDateTime: epubModifiedDate,
								...epubData,
							};

							mergedSources.push(obj);
						}

						// assigning next issue
						monthMwb = monthMwb + 2;
						if (monthMwb === 13) {
							monthMwb = 1;
							currentYear++;
						}
					}
				} while (notFound === false);

				resolve(mergedSources);
			} catch (err) {
				notFound = true;
				reject(err);
			}
		});

		it(`Test live download from jw.org for ${language} language`, (done) => {
			fetchData.then((mergedSources) => {
				expect(mergedSources).to.be.an('array').to.have.lengthOf.above(0);
				done();
			});
		});
	}
});
