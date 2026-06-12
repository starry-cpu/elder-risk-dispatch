<template>
  <view class="page">
    <AppNavbar title="巡访记录" />

    <!-- 老人信息区 -->
    <view class="form-section">
      <text class="form-section__label">老人信息</text>
      <view class="form-input-wrap">
        <input
          v-model="elderId"
          class="form-input"
          placeholder="输入老人编号或姓名"
          placeholder-style="color: #9E9990"
        />
      </view>
    </view>

    <!-- 巡访观察区 -->
    <view class="form-section">
      <text class="form-section__label">巡访观察</text>
      <view class="form-textarea-wrap">
        <textarea
          v-model="observation"
          class="form-textarea"
          placeholder="记录巡访中观察到的情况..."
          placeholder-style="color: #9E9990"
          :maxlength="2000"
          auto-height
        />
      </view>
    </view>

    <!-- 现场照片区 -->
    <view class="form-section">
      <text class="form-section__label">现场照片</text>
      <view class="photo-grid">
        <view
          v-for="(photo, idx) in photos"
          :key="idx"
          class="photo-grid__item"
        >
          <image :src="photo" class="photo-grid__img" mode="aspectFill" />
          <view class="photo-grid__remove" @click="removePhoto(photo)">
            <text>×</text>
          </view>
        </view>
        <view
          v-if="photos.length < MAX_PHOTOS"
          class="photo-grid__add"
          @click="takePhoto"
        >
          <text class="photo-grid__add-icon">+</text>
        </view>
      </view>
    </view>

    <!-- 补充说明区 -->
    <view class="form-section">
      <text class="form-section__label">补充说明</text>
      <view class="form-textarea-wrap">
        <textarea
          v-model="note"
          class="form-textarea form-textarea--short"
          placeholder="其他需要记录的内容..."
          placeholder-style="color: #9E9990"
          :maxlength="500"
        />
      </view>
    </view>

    <!-- 底部提交按钮（固定） -->
    <view class="form-footer">
      <AppButton type="primary" size="full" :loading="submitting" @click="handleSubmit">
        提交巡访记录
      </AppButton>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import AppNavbar from '@/components/AppNavbar.vue';
import AppButton from '@/components/AppButton.vue';
import { visitsApi } from '@/api/visits';
import { useVisitForm } from '@/composables/useVisitForm';

const { photos, submitting, MAX_PHOTOS, validate, addPhoto, removePhoto, clearPhotos } = useVisitForm();

const elderId = ref('');
const observation = ref('');
const note = ref('');

function resetForm() {
  elderId.value = '';
  observation.value = '';
  note.value = '';
  clearPhotos();
}

function takePhoto() {
  uni.chooseImage({
    count: 1,
    success: (res: any) => {
      if (res.tempFilePaths?.[0]) {
        addPhoto(res.tempFilePaths[0]);
      }
    },
  });
}

async function handleSubmit() {
  const result = validate({ elderId: elderId.value, observation: observation.value });
  if (!result.valid) {
    uni.showToast({ title: result.message || '请完善表单', icon: 'none' });
    return;
  }
  submitting.value = true;
  try {
    await visitsApi.create({
      elderId: elderId.value,
      observation: observation.value,
      photos: photos.value.length > 0 ? photos.value : undefined,
      note: note.value || undefined,
    });
    uni.showToast({ title: '提交成功' });
    resetForm();
  } catch {
    // client interceptor already shows toast
  } finally {
    submitting.value = false;
  }
}
</script>

<style scoped>
.page {
  min-height: 100vh;
  background-color: #F7F3ED;
  padding-bottom: 140rpx;
}
.form-section {
  padding: 0 20rpx;
  margin-top: 32rpx;
}
.form-section__label {
  font-size: 22rpx;
  color: #9E9990;
  margin-bottom: 12rpx;
  display: block;
}
.form-input-wrap {
  border-bottom: 1rpx solid #E8E3DA;
  padding: 12rpx 0;
}
.form-input {
  width: 100%;
  font-size: 28rpx;
  color: #2C2B29;
  height: 56rpx;
  line-height: 56rpx;
}
.form-textarea-wrap {
  border-bottom: 1rpx solid #E8E3DA;
  padding: 12rpx 0;
}
.form-textarea {
  width: 100%;
  min-height: 240rpx;
  font-size: 28rpx;
  color: #2C2B29;
  line-height: 1.6;
}
.form-textarea--short {
  min-height: 120rpx;
}

.photo-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
}
.photo-grid__item {
  width: 160rpx;
  height: 160rpx;
  border-radius: 8rpx;
  overflow: hidden;
  position: relative;
}
.photo-grid__img {
  width: 100%;
  height: 100%;
}
.photo-grid__remove {
  position: absolute;
  top: -4rpx;
  right: -4rpx;
  width: 40rpx;
  height: 40rpx;
  background-color: #C4706B;
  color: #FEFDFB;
  border-radius: 9999rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24rpx;
}
.photo-grid__add {
  width: 160rpx;
  height: 160rpx;
  border: 2rpx dashed #D0CBC2;
  border-radius: 8rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}
.photo-grid__add-icon {
  font-size: 48rpx;
  color: #9E9990;
}

.form-footer {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 20rpx 20rpx;
  padding-bottom: calc(20rpx + env(safe-area-inset-bottom));
  background-color: #F7F3ED;
}
</style>
