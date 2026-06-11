<template>
  <view class="page p-4">
    <view class="bg-white rounded-lg p-4 shadow-sm space-y-4">
      <view class="text-lg font-bold">新增巡访记录</view>
      <view><text class="text-sm text-gray-500">选择老人</text><wd-input v-model="elderId" placeholder="请输入老人ID" /></view>
      <view><text class="text-sm text-gray-500">观察记录 *</text><wd-textarea v-model="observation" :rows="4" placeholder="请详细记录观察内容" /></view>
      <view><text class="text-sm text-gray-500">照片 (最多{{ MAX_PHOTOS }}张)</text>
        <view class="flex flex-wrap gap-2 mt-2">
          <view v-for="(photo, idx) in photos" :key="idx" class="relative w-20 h-20 bg-gray-200 rounded"><image :src="photo" class="w-full h-full rounded" mode="aspectFill" /><view class="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex-center text-xs" @click="removePhoto(photo)">×</view></view>
          <view v-if="photos.length < MAX_PHOTOS" class="w-20 h-20 border border-dashed border-gray-300 rounded flex-center" @click="takePhoto"><text class="text-2xl text-gray-400">+</text></view>
        </view>
      </view>
      <view><text class="text-sm text-gray-500">备注</text><wd-input v-model="note" placeholder="选填" /></view>
      <wd-button type="primary" block :loading="submitting" @click="handleSubmit">提交</wd-button>
    </view>
  </view>
</template>
<script setup lang="ts">
import { ref } from 'vue';
import { useVisitForm } from '@/composables/useVisitForm';
const { photos, submitting, MAX_PHOTOS, validate, addPhoto, removePhoto } = useVisitForm();
const elderId = ref(''); const observation = ref(''); const note = ref('');
function takePhoto() { uni.chooseImage({ count: 1, success: (res: any) => { addPhoto(res.tempFilePaths[0]); } }); }
function handleSubmit() { const result = validate({ elderId: elderId.value, observation: observation.value }); if (!result.valid) { uni.showToast({ title: result.message || '请完善表单', icon: 'none' }); return; } submitting.value = true; uni.request({ url: '/api/v1/visits', method: 'POST', data: { elderId: elderId.value, observation: observation.value, photos: photos.value, note: note.value }, header: { Authorization: `Bearer ${uni.getStorageSync('token')}` }, complete: () => { submitting.value = false; }, success: () => { uni.showToast({ title: '提交成功' }); elderId.value = ''; observation.value = ''; } }); }
</script>
