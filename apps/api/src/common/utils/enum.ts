import { Gender as G } from '@qotm/db/enums';
namespace Enum {
	/**
	 * S3 key prefixes. Add a folder here rather than passing a raw string, and
	 * list it in `PrivateUploadFolders` if its objects must not be publicly
	 * readable — that set is what decides the object ACL on upload, so an
	 * omission silently makes private files world-readable.
	 */
	export enum UploadFolder {
		AVATARS = 'avatars',
		UPLOAD = 'upload',
		PRIVATE = 'private'
	}

	export const PrivateUploadFolders: ReadonlySet<UploadFolder> = new Set([
		UploadFolder.PRIVATE
	]);

	export const isPrivateUploadFolder = (folder: UploadFolder) =>
		PrivateUploadFolders.has(folder);

	export enum Gender {
		MALE = 'male',
		FEMALE = 'female'
	}
	export type UserGender = G | Gender;
	export const Genders = Object.values(Gender);
	export const gendersErrorMessage = () => {
		const GENDER: Record<Gender, string> = {
			[Gender.MALE]: 'male',
			[Gender.FEMALE]: 'female'
		};

		const genders = Genders.map((g) => `${g} (${GENDER[g]})`).join(', ');
		return `genderId must be one of [${genders}]`;
	};
}

export default Enum;
