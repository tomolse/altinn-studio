/* eslint-disable no-undef */
/* eslint-disable max-len */
/* eslint-disable no-param-reassign */
/* eslint-disable no-restricted-syntax */
/* eslint-disable consistent-return */
import { SagaIterator } from 'redux-saga';
import { call, select, takeLatest } from 'redux-saga/effects';
import * as SharedNetwork from 'app-shared/utils/networking';
import postMessages from 'app-shared/utils/postMessages';
import * as FormDesignerActions from '../../actions/formDesignerActions/actions';
import FormDesignerActionDispatchers from '../../actions/formDesignerActions/formDesignerActionDispatcher';
import * as FormDesignerActionTypes from '../../actions/formDesignerActions/formDesignerActionTypes';
import { IFormDesignerState } from '../../reducers/formDesignerReducer';
import { convertFromLayoutToInternalFormat, convertInternalToLayoutFormat } from '../../utils/formLayout';
import { get, post } from '../../utils/networking';
import { getAddApplicationMetadataUrl, getDeleteApplicationMetadataUrl, getSaveFormLayoutUrl, getUpdateApplicationMetadataUrl } from '../../utils/urlHelper';
import { IAddLayoutAction, IDeleteLayoutAction, IUpdateContainerIdAction, IUpdateLayoutNameAction, IUpdateSelectedLayoutAction } from '../../actions/formDesignerActions/actions';
// tslint:disable-next-line:no-var-requires
const uuid = require('uuid/v4');

const selectFormDesigner = (state: IAppState): IFormDesignerState => state.formDesigner;
const selectCurrentLayout = (state: IAppState): IFormLayout => state.formDesigner.layout.layouts[state.formDesigner.layout.selectedLayout];

function* addActiveFormContainerSaga({ containerId }: FormDesignerActions.IAddActiveFormContainerAction): SagaIterator {
  try {
    const formDesignerState: IFormDesignerState = yield select(selectFormDesigner);
    yield call(
      FormDesignerActionDispatchers.addActiveFormContainerFulfilled,
      containerId === formDesignerState.layout.activeContainer ? '' : containerId,
    );
  } catch (err) {
    yield call(FormDesignerActionDispatchers.addFormComponentRejected, err);
  }
}

export function* watchAddActiveFormContainerSaga(): SagaIterator {
  yield takeLatest(
    FormDesignerActionTypes.ADD_ACTIVE_FORM_CONTAINER,
    addActiveFormContainerSaga,
  );
}

function* addFormComponentSaga({
  component,
  position,
  containerId,
  callback,
}: FormDesignerActions.IAddFormComponentAction): SagaIterator {
  try {
    const id: string = uuid();
    const currentLayout: IFormLayout = yield select(selectCurrentLayout);

    if (!containerId) {
      // if not containerId set it to base-container
      containerId = Object.keys(currentLayout.order)[0];
    }
    if (!position) {
      // if position is undefined, put it on top
      position = 0;
    }
    yield call(
      FormDesignerActionDispatchers.addFormComponentFulfilled,
      component,
      id,
      position,
      containerId,
      callback,
    );
    const saveFormLayoutUrl: string = yield call(getSaveFormLayoutUrl);
    yield call(
      FormDesignerActionDispatchers.saveFormLayout,
      saveFormLayoutUrl,
    );
    if (component.type === 'FileUpload') {
      const {
        maxNumberOfAttachments,
        minNumberOfAttachments,
        maxFileSizeInMB,
        validFileEndings,
      } = component as IFormFileUploaderComponent;
      yield call(FormDesignerActionDispatchers.addApplicationMetadata,
        id, maxNumberOfAttachments, minNumberOfAttachments, maxFileSizeInMB, validFileEndings);
    }
    return id; // returns created id
  } catch (err) {
    yield call(FormDesignerActionDispatchers.addFormComponentRejected, err);
    console.error(err);
  }
}

export function* watchAddFormComponentSaga(): SagaIterator {
  yield takeLatest(
    FormDesignerActionTypes.ADD_FORM_COMPONENT,
    addFormComponentSaga,
  );
}

function* addFormContainerSaga({
  container,
  positionAfterId,
  addToId,
  callback,
  destinationIndex,
}: FormDesignerActions.IAddFormContainerAction): SagaIterator {
  try {
    const id = uuid();
    const currentLayout: IFormLayout = yield select(selectCurrentLayout);
    let baseContainerId;
    if (Object.keys(currentLayout.order)
      && Object.keys(currentLayout.order).length > 0) {
      baseContainerId = Object.keys(currentLayout.order)[0];
    }

    yield call(
      FormDesignerActionDispatchers.addFormContainerFulfilled,
      container,
      id,
      positionAfterId,
      addToId,
      baseContainerId,
      callback,
      destinationIndex,
    );
    const saveFormLayoutUrl: string = yield call(getSaveFormLayoutUrl);
    yield call(
      FormDesignerActionDispatchers.saveFormLayout,
      saveFormLayoutUrl,
    );
  } catch (err) {
    yield call(FormDesignerActionDispatchers.addFormContainerRejected, err);
  }
}

export function* watchAddFormContainerSaga(): SagaIterator {
  yield takeLatest(
    FormDesignerActionTypes.ADD_FORM_CONTAINER,
    addFormContainerSaga,
  );
}

function* deleteFormComponentSaga({
  id,
}: FormDesignerActions.IDeleteComponentAction): SagaIterator {
  try {
    const currentLayout: IFormLayout = yield select(selectCurrentLayout);
    let containerId = Object.keys(currentLayout.order)[0];
    Object.keys(currentLayout.order).forEach((cId) => {
      if (currentLayout.order[cId].find((componentId) => componentId === id)) {
        containerId = cId;
      }
    });
    yield call(FormDesignerActionDispatchers.deleteFormComponentFulfilled, id, containerId);
    const saveFormLayoutUrl: string = yield call(getSaveFormLayoutUrl);
    yield call(
      FormDesignerActionDispatchers.saveFormLayout,
      saveFormLayoutUrl,
    );
    const component = currentLayout.components[id];

    if (component.type === 'FileUpload') {
      yield call(FormDesignerActionDispatchers.deleteApplicationMetadata,
        id);
    }
  } catch (err) {
    yield call(FormDesignerActionDispatchers.deleteFormComponentRejected, err);
  }
}

export function* watchDeleteFormComponentSaga(): SagaIterator {
  yield takeLatest(
    FormDesignerActionTypes.DELETE_FORM_COMPONENT,
    deleteFormComponentSaga,
  );
}

function* deleteFormContainerSaga({
  id,
}: FormDesignerActions.IDeleteContainerAction): SagaIterator {
  try {
    const currentLayout: IFormLayout = yield select(selectCurrentLayout);
    for (const componentId of currentLayout.order[id]) {
      yield call(FormDesignerActionDispatchers.deleteFormComponentFulfilled, componentId, id);
    }
    yield call(FormDesignerActionDispatchers.deleteFormContainerFulfilled, id);
    const saveFormLayoutUrl: string = yield call(getSaveFormLayoutUrl);
    yield call(
      FormDesignerActionDispatchers.saveFormLayout,
      saveFormLayoutUrl,
    );
  } catch (err) {
    yield call(FormDesignerActionDispatchers.deleteFormContainerRejected, err);
  }
}

export function* watchDeleteFormContainerSaga(): SagaIterator {
  yield takeLatest(
    FormDesignerActionTypes.DELETE_FORM_CONTAINER,
    deleteFormContainerSaga,
  );
}

function* fetchFormLayoutSaga({
  url,
}: FormDesignerActions.IFetchFormLayoutAction): SagaIterator {
  try {
    const formLayouts: any = yield call(get, url);
    const convertedLayouts: IFormLayouts = {};
    if (!formLayouts || Object.keys(formLayouts).length === 0) {
      // Default name if no formlayout exists
      convertedLayouts.FormLayout = convertFromLayoutToInternalFormat(null);
    } else {
      Object.keys(formLayouts).forEach((layoutName: string) => {
        if (!formLayouts[layoutName] || !formLayouts[layoutName].data) {
          convertedLayouts[layoutName] = convertFromLayoutToInternalFormat(null);
        } else {
          convertedLayouts[layoutName] = convertFromLayoutToInternalFormat(formLayouts[layoutName].data.layout);
        }
      });
    }
    yield call(
      FormDesignerActionDispatchers.fetchFormLayoutFulfilled,
      convertedLayouts,
    );

    yield call(FormDesignerActionDispatchers.updateSelectedLayout, Object.keys(convertedLayouts)[0]);
  } catch (err) {
    console.error(err);
    yield call(FormDesignerActionDispatchers.fetchFormLayoutRejected, err);
  }
}

export function* watchFetchFormLayoutSaga(): SagaIterator {
  yield takeLatest(
    FormDesignerActionTypes.FETCH_FORM_LAYOUT,
    fetchFormLayoutSaga,
  );
}

function* saveFormLayoutSaga({
  url,
}: FormDesignerActions.ISaveFormLayoutAction): SagaIterator {
  try {
    const layouts = yield select((state: IAppState) => state.formDesigner.layout.layouts);
    interface IConverted {
      [id: string]: object;
    }
    const convertedLayouts: IConverted = {};
    Object.keys(layouts).forEach((layoutName: string) => {
      convertedLayouts[layoutName] = {
        data: {
          layout: convertInternalToLayoutFormat(layouts[layoutName]),
        },
      };
    });
    yield call(post, url, convertedLayouts);
    yield call(FormDesignerActionDispatchers.saveFormLayoutFulfilled);
    window.postMessage(postMessages.filesAreSaved, window.location.href);
  } catch (err) {
    yield call(FormDesignerActionDispatchers.saveFormLayoutRejected, err);
  }
}

export function* watchSaveFormLayoutSaga(): SagaIterator {
  yield takeLatest(
    FormDesignerActionTypes.SAVE_FORM_LAYOUT,
    saveFormLayoutSaga,
  );
}

function* updateDataModelBindingSaga({
  dataModelBinding,
  id,
}: FormDesignerActions.IUpdateDataModelBindingAction): SagaIterator {
  try {
    yield call(
      FormDesignerActionDispatchers.updateDataModelBindingFulfilled,
      dataModelBinding,
      id,
    );
  } catch (err) {
    yield call(
      FormDesignerActionDispatchers.updateDataModelBindingRejected,
      err,
    );
  }
}

export function* watchUpdateDataModelBindingSaga(): SagaIterator {
  yield takeLatest(
    FormDesignerActionTypes.UPDATE_DATA_MODEL_BINDING,
    updateDataModelBindingSaga,
  );
}

function* updateFormComponentSaga({
  updatedComponent,
  id,
}: FormDesignerActions.IUpdateFormComponentAction): SagaIterator {
  try {
    yield call(
      FormDesignerActionDispatchers.updateFormComponentFulfilled,
      updatedComponent,
      id,
    );
    const saveFormLayoutUrl: string = yield call(getSaveFormLayoutUrl);
    yield call(
      FormDesignerActionDispatchers.saveFormLayout,
      saveFormLayoutUrl,
    );
    if (updatedComponent.type === 'FileUpload') {
      const {
        maxNumberOfAttachments,
        minNumberOfAttachments,
        maxFileSizeInMB,
        validFileEndings,
      } = updatedComponent as IFormFileUploaderComponent;
      yield call(FormDesignerActionDispatchers.updateApplicationMetadata,
        id, maxNumberOfAttachments, minNumberOfAttachments, maxFileSizeInMB, validFileEndings);
    }
  } catch (err) {
    yield call(FormDesignerActionDispatchers.updateFormComponentRejected, err);
  }
}

export function* watchUpdateFormComponentSaga(): SagaIterator {
  yield takeLatest(
    FormDesignerActionTypes.UPDATE_FORM_COMPONENT,
    updateFormComponentSaga,
  );
}

export function* updateFormContainerSaga({
  updatedContainer,
  id,
}: FormDesignerActions.IUpdateFormContainerAction): SagaIterator {
  try {
    yield call(
      FormDesignerActionDispatchers.updateFormContainerFulfilled,
      updatedContainer,
      id,
    );
    yield call(
      FormDesignerActionDispatchers.saveFormLayout,
      getSaveFormLayoutUrl(),
    );
  } catch (err) {
    yield call(FormDesignerActionDispatchers.updateFormContainerRejected, err);
  }
}

export function* watchUpdateContainerSaga(): SagaIterator {
  yield takeLatest(
    FormDesignerActionTypes.UPDATE_FORM_CONTAINER,
    updateFormContainerSaga,
  );
}

export function* updateFormComponentOrderSaga({
  updatedOrder,
}: FormDesignerActions.IUpdateFormComponentOrderAction): SagaIterator {
  try {
    yield call(FormDesignerActionDispatchers.updateFormComponentOrderActionFulfilled,
      updatedOrder);
    const saveFormLayoutUrl: string = yield call(getSaveFormLayoutUrl);
    yield call(
      FormDesignerActionDispatchers.saveFormLayout,
      saveFormLayoutUrl,
    );
  } catch (err) {
    yield call(FormDesignerActionDispatchers.updatedFormComponentOrderActionRejected,
      err);
  }
}

export function* watchUpdateFormComponentOrderSaga(): SagaIterator {
  yield takeLatest(
    FormDesignerActionTypes.UPDATE_FORM_COMPONENT_ORDER,
    updateFormComponentOrderSaga,
  );
}

export function* addApplicationMetadata({
  id,
  maxFiles,
  minFiles,
  maxSize,
  fileType,
}: FormDesignerActions.IAddApplicationMetadataAction): SagaIterator {
  try {
    const addApplicationMetadataUrl: string = yield call(getAddApplicationMetadataUrl);
    yield call(SharedNetwork.post, addApplicationMetadataUrl,
      {
        id,
        maxCount: maxFiles,
        minCount: minFiles,
        maxSize,
        fileType,
      });
    yield call(
      FormDesignerActionDispatchers.addApplicationMetadataFulfilled,
    );
  } catch (error) {
    yield call(FormDesignerActionDispatchers.addApplicationMetadataRejected,
      error);
  }
}

export function* watchAddApplicationMetadataSaga(): SagaIterator {
  yield takeLatest(FormDesignerActionTypes.ADD_APPLICATION_METADATA, addApplicationMetadata);
}

export function* deleteApplicationMetadata({
  id,
}: FormDesignerActions.IDeleteApplicationMetadataAction): SagaIterator {
  try {
    const deleteApplicationMetadataUrl: string = yield call(getDeleteApplicationMetadataUrl);
    yield call(SharedNetwork.post, deleteApplicationMetadataUrl + id,
      {
        id,
      });
    yield call(
      FormDesignerActionDispatchers.deleteApplicationMetadataFulfilled,
    );
  } catch (error) {
    yield call(FormDesignerActionDispatchers.deleteApplicationMetadataRejected,
      error);
  }
}

export function* watchDeleteApplicationMetadataSaga(): SagaIterator {
  yield takeLatest(FormDesignerActionTypes.DELETE_APPLICATION_METADATA, deleteApplicationMetadata);
}

export function* updateApplicationMetadata({
  id,
  maxFiles,
  minFiles,
  maxSize,
  fileType,
}: FormDesignerActions.IAddApplicationMetadataAction): SagaIterator {
  try {
    const updateApplicationMetadataUrl: string = yield call(getUpdateApplicationMetadataUrl);
    yield call(SharedNetwork.post, updateApplicationMetadataUrl,
      {
        id,
        maxCount: maxFiles,
        minCount: minFiles,
        maxSize,
        fileType,
      });
    yield call(
      FormDesignerActionDispatchers.updateApplicationMetadataFulfilled,
    );
  } catch (error) {
    yield call(FormDesignerActionDispatchers.updateApplicationMetadataRejected,
      error);
  }
}

export function* watchUpdateApplicationMetadataSaga(): SagaIterator {
  yield takeLatest(FormDesignerActionTypes.UPDATE_APPLICATION_METADATA, updateApplicationMetadata);
}

export function* updateContainerIdSaga({ currentId, newId }: IUpdateContainerIdAction): SagaIterator {
  try {
    yield call(FormDesignerActionDispatchers.updateContainerIdFulfilled, currentId, newId);
    yield call(FormDesignerActionDispatchers.saveFormLayout, getSaveFormLayoutUrl());
  } catch (error) {
    yield call(FormDesignerActionDispatchers.updateContainerIdRejected, error);
  }
}

export function* watchUpdateContainerIdSaga(): SagaIterator {
  yield takeLatest(FormDesignerActionTypes.UPDATE_CONTAINER_ID, updateContainerIdSaga);
}

export function* updateSelectedLayoutSaga({ selectedLayout } : IUpdateSelectedLayoutAction) : SagaIterator {
  yield call(FormDesignerActionDispatchers.updateSelectedLayoutFulfilled, selectedLayout);
}

export function* watchUpdateSelectedLayoutSaga(): SagaIterator {
  yield takeLatest(FormDesignerActionTypes.UPDATE_SELECTED_LAYOUT, updateSelectedLayoutSaga);
}

export function* deleteLayoutSaga({ layout }: IDeleteLayoutAction): SagaIterator {
  yield call(FormDesignerActionDispatchers.deleteLayoutFulfilled, layout);
  const saveFormLayoutUrl: string = yield call(getSaveFormLayoutUrl);
  yield call(FormDesignerActionDispatchers.saveFormLayout, saveFormLayoutUrl);
  const layouts = yield select((state: IAppState) => state.formDesigner.layout.layouts);
  const newSelected = Object.keys(layouts)[0] || '';
  yield call(FormDesignerActionDispatchers.updateSelectedLayout, newSelected);
}

export function* watchDeleteLayoutSaga(): SagaIterator {
  yield takeLatest(FormDesignerActionTypes.DELETE_LAYOUT, deleteLayoutSaga);
}

export function* addLayoutSaga({ layout }: IAddLayoutAction): SagaIterator {
  const layouts = yield select((state: IAppState) => state.formDesigner.layout.layouts);
  const layoutsCopy = JSON.parse(JSON.stringify(layouts));
  layoutsCopy[layout] = convertFromLayoutToInternalFormat(null);
  yield call(FormDesignerActionDispatchers.addLayoutFulfilled, layoutsCopy);
}

export function* watchAddLayoutSaga(): SagaIterator {
  yield takeLatest(FormDesignerActionTypes.ADD_LAYOUT, addLayoutSaga);
}

export function* updateLayoutNameSaga({ oldName, newName }: IUpdateLayoutNameAction): SagaIterator {
  yield call(FormDesignerActionDispatchers.updateLayoutNameFulfilled, oldName, newName);
  yield call(FormDesignerActionDispatchers.updateSelectedLayout, newName);
}

export function* watchUpdateLayoutNameSaga(): SagaIterator {
  yield takeLatest(FormDesignerActionTypes.UPDATE_LAYOUT_NAME, updateLayoutNameSaga);
}
